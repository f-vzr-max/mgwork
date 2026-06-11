// Unit tests for lib/social/identity.ts — identity linking + webhook
// idempotency (channels phase 0).
//
// Mock @/lib/prisma, @/lib/audit, @/lib/claude and @/lib/i18n BEFORE importing
// the module under test so the imports bind to the mocks (same pattern as
// llm-bridge.test.ts; the module's relative imports resolve to the same files
// as the @/lib/* aliases). tFor is mocked to echo the i18n KEY so assertions
// are catalog-independent.

const idMockPrisma = {
  channelIdentity: {
    upsert: jest.fn() as jest.Mock,
    update: jest.fn() as jest.Mock,
    findUnique: jest.fn() as jest.Mock,
  },
  channelLinkToken: {
    findUnique: jest.fn() as jest.Mock,
    updateMany: jest.fn() as jest.Mock,
    create: jest.fn() as jest.Mock,
  },
  candidate: {
    findUnique: jest.fn() as jest.Mock,
    findFirst: jest.fn() as jest.Mock,
    update: jest.fn() as jest.Mock,
  },
  conversation: {
    updateMany: jest.fn() as jest.Mock,
  },
  webhookEvent: {
    create: jest.fn() as jest.Mock,
    updateMany: jest.fn() as jest.Mock,
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: idMockPrisma,
}));

const mockLogAudit = jest.fn();
jest.mock("@/lib/audit", () => ({
  logAudit: mockLogAudit,
}));

// memory.ts (imported by identity.ts) pulls in lib/claude — stub it out so no
// SDK/env access happens at import time.
jest.mock("@/lib/claude", () => ({
  chat: jest.fn(),
  chatWithEscalation: jest.fn(),
}));

jest.mock("@/lib/i18n", () => ({
  tFor: () => (key: string) => key,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const identity = require("@/lib/social/identity");

type AnyRecord = Record<string, unknown>;

function identityRow(over: AnyRecord = {}): AnyRecord {
  return {
    id: "ci-1",
    platform: "WHATSAPP",
    externalUserId: "26134000111",
    candidateId: null,
    status: "PENDING",
    linkedVia: null,
    pendingExtract: null,
    msgCountDay: 0,
    msgWindowStart: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...over,
  };
}

function inbound(over: AnyRecord = {}): AnyRecord {
  return {
    platform: "WHATSAPP",
    threadId: "phone-id-1",
    externalId: "wamid.1",
    senderId: "26134000111",
    text: "Hello",
    receivedAt: new Date(),
    ...over,
  };
}

// candidate.findUnique is called with several distinct selects across the
// linking flow — dispatch on the select shape.
function wireCandidateFindUnique(): void {
  idMockPrisma.candidate.findUnique.mockImplementation(
    (args: { select?: AnyRecord }) => {
      if (args.select?.skills) return Promise.resolve({ skills: [], sectors: [] });
      if (args.select?.userId) return Promise.resolve({ userId: "user-1" });
      if (args.select?.user) return Promise.resolve({ user: { lang: "FR" } });
      if (args.select?.id) return Promise.resolve({ id: "cand-1" });
      if (args.select?.memory) return Promise.resolve({ memory: null });
      return Promise.resolve(null);
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  idMockPrisma.channelIdentity.update.mockResolvedValue({});
  idMockPrisma.channelIdentity.findUnique.mockResolvedValue({ pendingExtract: null });
  idMockPrisma.candidate.update.mockResolvedValue({});
  idMockPrisma.candidate.findFirst.mockResolvedValue(null);
  idMockPrisma.conversation.updateMany.mockResolvedValue({ count: 0 });
  idMockPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
  wireCandidateFindUnique();
});

// ---------------------------------------------------------------------------
// Webhook idempotency
// ---------------------------------------------------------------------------

describe("recordWebhookEvent (idempotency gate)", () => {
  it("returns true on a fresh externalId", async () => {
    idMockPrisma.webhookEvent.create.mockResolvedValue({});
    await expect(identity.recordWebhookEvent("WHATSAPP", "wamid.1")).resolves.toBe(true);
    expect(idMockPrisma.webhookEvent.create).toHaveBeenCalledWith({
      data: { platform: "WHATSAPP", externalId: "wamid.1" },
    });
  });

  it("returns false on a duplicate delivery (P2002) when no stale row is claimable", async () => {
    idMockPrisma.webhookEvent.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    idMockPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 0 });
    await expect(identity.recordWebhookEvent("WHATSAPP", "wamid.1")).resolves.toBe(false);
  });

  it("re-claims a stale UNPROCESSED duplicate (crashed first attempt) as fresh", async () => {
    idMockPrisma.webhookEvent.create.mockRejectedValue(
      Object.assign(new Error("dup"), { code: "P2002" }),
    );
    idMockPrisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });
    await expect(identity.recordWebhookEvent("WHATSAPP", "wamid.1")).resolves.toBe(true);
    // The claim is atomic on processedAt:null + a stale createdAt cutoff.
    expect(idMockPrisma.webhookEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ externalId: "wamid.1", processedAt: null }),
      }),
    );
  });

  it("fails open (true) on a non-unique-violation error", async () => {
    idMockPrisma.webhookEvent.create.mockRejectedValue(new Error("db down"));
    await expect(identity.recordWebhookEvent("WHATSAPP", "wamid.1")).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Link-code parsing + issuing
// ---------------------------------------------------------------------------

describe("parseLinkCode / generateLinkCode", () => {
  it("parses 'LINK <code>' case-insensitively and uppercases the code", () => {
    expect(identity.parseLinkCode("LINK ABC23456")).toBe("ABC23456");
    expect(identity.parseLinkCode("link abc23456")).toBe("ABC23456");
    expect(identity.parseLinkCode("Link: abc23456")).toBe("ABC23456");
  });

  it("rejects non-link text", () => {
    expect(identity.parseLinkCode("hello")).toBeNull();
    expect(identity.parseLinkCode("LINKABC23456")).toBeNull();
    expect(identity.parseLinkCode("")).toBeNull();
  });

  it("generates 8-char codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 20; i++) {
      expect(identity.generateLinkCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it("issueLinkToken stores a one-time token with ~15-min expiry", async () => {
    idMockPrisma.channelLinkToken.create.mockResolvedValue({});
    const before = Date.now();
    const { code, expiresAt } = await identity.issueLinkToken("cand-1");
    expect(code).toHaveLength(8);
    const ttl = expiresAt.getTime() - before;
    expect(ttl).toBeGreaterThan(14 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000 + 1_000);
  });
});

// ---------------------------------------------------------------------------
// Token redemption
// ---------------------------------------------------------------------------

describe("handleInbound — token redemption", () => {
  const validToken = {
    id: "tok-1",
    code: "ABC23456",
    candidateId: "cand-1",
    platform: null,
    usedAt: null,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  };

  it("links the identity (TOKEN) and audits on a valid 'LINK <code>'", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue(validToken);
    idMockPrisma.channelLinkToken.updateMany.mockResolvedValue({ count: 1 });

    const action = await identity.handleInbound(inbound({ text: "LINK ABC23456" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkSuccess" });
    expect(idMockPrisma.channelIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ci-1" },
        data: { candidateId: "cand-1", status: "LINKED", linkedVia: "TOKEN" },
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "channel.link", resourceId: "ci-1" }),
    );
  });

  it("redeems via Messenger referral ref (no text)", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({ platform: "MESSENGER", externalUserId: "psid-1" }),
    );
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue(validToken);
    idMockPrisma.channelLinkToken.updateMany.mockResolvedValue({ count: 1 });

    const action = await identity.handleInbound(
      inbound({ platform: "MESSENGER", senderId: "psid-1", text: "", referralRef: "ABC23456" }),
    );

    expect(action).toEqual({ kind: "reply", text: "channels.linkSuccess" });
  });

  it("rejects an expired token without consuming it", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 1_000),
    });

    const action = await identity.handleInbound(inbound({ text: "LINK ABC23456" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkInvalid" });
    expect(idMockPrisma.channelLinkToken.updateMany).not.toHaveBeenCalled();
  });

  it("counts a failed redemption under __linkFails (guess throttle)", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue(null);

    const action = await identity.handleInbound(inbound({ text: "LINK WRONG234" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkInvalid" });
    const write = idMockPrisma.channelIdentity.update.mock.calls.find(
      (c: AnyRecord[]) =>
        (c[0] as { data: { pendingExtract?: { __linkFails?: unknown } } }).data.pendingExtract
          ?.__linkFails,
    );
    expect(write).toBeDefined();
    expect(write![0].data.pendingExtract.__linkFails.n).toBe(1);
  });

  it("silences LINK attempts past LINK_FAIL_MAX inside the window", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        pendingExtract: {
          __linkFails: { ws: new Date().toISOString(), n: identity.LINK_FAIL_MAX },
        },
      }),
    );

    const action = await identity.handleInbound(inbound({ text: "LINK WRONG234" }));

    expect(action).toEqual({ kind: "silent", reason: "link-fails" });
    expect(idMockPrisma.channelLinkToken.findUnique).not.toHaveBeenCalled();
  });

  it("is one-time: a concurrent retry losing the atomic claim gets linkInvalid", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue(validToken);
    idMockPrisma.channelLinkToken.updateMany.mockResolvedValue({ count: 0 });

    const action = await identity.handleInbound(inbound({ text: "LINK ABC23456" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkInvalid" });
    expect(idMockPrisma.channelIdentity.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "LINKED" }) }),
    );
  });

  it("replays pendingExtract onto the candidate on link", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.channelIdentity.findUnique.mockResolvedValue({
      pendingExtract: { firstName: "Hery", skills: ["welding"], __anonTurns: 3 },
    });
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue(validToken);
    idMockPrisma.channelLinkToken.updateMany.mockResolvedValue({ count: 1 });

    await identity.handleInbound(inbound({ text: "LINK ABC23456" }));

    expect(idMockPrisma.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cand-1" },
        data: expect.objectContaining({ firstName: "Hery", skills: ["welding"] }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// WhatsApp phone-match confirm flow
// ---------------------------------------------------------------------------

describe("handleInbound — phone match", () => {
  it("offers a phone match (pending confirm) instead of bridging", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.candidate.findFirst.mockResolvedValue({ id: "cand-9" });

    const action = await identity.handleInbound(inbound({ text: "Salama" }));

    expect(action).toEqual({ kind: "reply", text: "channels.phoneMatchPrompt" });
    const writes = idMockPrisma.channelIdentity.update.mock.calls;
    const last = writes[writes.length - 1][0];
    expect(last.data.pendingExtract.__phoneMatch.candidateId).toBe("cand-9");
  });

  it("links via PHONE_MATCH only after an explicit YES", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        pendingExtract: { __phoneMatch: { candidateId: "cand-9", at: new Date().toISOString() } },
      }),
    );

    const action = await identity.handleInbound(inbound({ text: "OUI" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkSuccess" });
    expect(idMockPrisma.channelIdentity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { candidateId: "cand-9", status: "LINKED", linkedVia: "PHONE_MATCH" },
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "channel.link" }),
    );
  });

  it("a non-YES reply declines the offer and bridges anonymously", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        pendingExtract: { __phoneMatch: { candidateId: "cand-9", at: new Date().toISOString() } },
      }),
    );

    const action = await identity.handleInbound(inbound({ text: "what jobs do you have?" }));

    expect(action).toEqual({ kind: "bridge", channelIdentityId: "ci-1", lang: "FR" });
    // Linking must NOT have happened.
    expect(idMockPrisma.channelIdentity.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "LINKED" }) }),
    );
  });
});

// ---------------------------------------------------------------------------
// Rate caps
// ---------------------------------------------------------------------------

describe("handleInbound — rate caps", () => {
  it("anonymous: 16th turn gets ONE linkRequired notice", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({ pendingExtract: { __anonTurns: 15 } }),
    );

    const action = await identity.handleInbound(inbound({ text: "Hello again" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkRequired" });
  });

  it("anonymous: stays silent after the notice", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        pendingExtract: {
          __anonTurns: 16,
          __capNotice: { scope: "anon", at: new Date().toISOString() },
        },
      }),
    );

    const action = await identity.handleInbound(inbound({ text: "Hello again" }));

    expect(action).toEqual({ kind: "silent", reason: "rate-anon" });
  });

  it("over-cap anonymous user can STILL redeem a link code", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        pendingExtract: {
          __anonTurns: 20,
          __capNotice: { scope: "anon", at: new Date().toISOString() },
        },
      }),
    );
    idMockPrisma.channelLinkToken.findUnique.mockResolvedValue({
      id: "tok-1",
      code: "ABC23456",
      candidateId: "cand-1",
      platform: null,
      usedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });
    idMockPrisma.channelLinkToken.updateMany.mockResolvedValue({ count: 1 });

    const action = await identity.handleInbound(inbound({ text: "LINK ABC23456" }));

    expect(action).toEqual({ kind: "reply", text: "channels.linkSuccess" });
  });

  it("linked: 11th message inside the 15-min window gets ONE rateLimited notice", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        status: "LINKED",
        candidateId: "cand-1",
        msgCountDay: 10,
        msgWindowStart: new Date(),
        pendingExtract: { __rate: { ws: new Date().toISOString(), n: 10 } },
      }),
    );

    const action = await identity.handleInbound(inbound({ text: "spam" }));

    expect(action).toEqual({ kind: "reply", text: "channels.rateLimited" });
  });

  it("linked: silent after the burst notice", async () => {
    const nowIso = new Date().toISOString();
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({
        status: "LINKED",
        candidateId: "cand-1",
        msgCountDay: 11,
        msgWindowStart: new Date(),
        pendingExtract: {
          __rate: { ws: nowIso, n: 11 },
          __capNotice: { scope: "burst", at: nowIso },
        },
      }),
    );

    const action = await identity.handleInbound(inbound({ text: "spam" }));

    expect(action).toEqual({ kind: "silent", reason: "rate-burst" });
  });
});

// ---------------------------------------------------------------------------
// Routine bridging + unlink
// ---------------------------------------------------------------------------

describe("handleInbound — bridging", () => {
  it("bridges a linked identity as the candidate (their locale)", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(
      identityRow({ status: "LINKED", candidateId: "cand-1" }),
    );

    const action = await identity.handleInbound(inbound({ text: "Bonjour" }));

    expect(action).toEqual({ kind: "bridge", candidateId: "cand-1", lang: "FR" });
  });

  it("bridges an anonymous identity by channelIdentityId when no phone match", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow());
    idMockPrisma.candidate.findFirst.mockResolvedValue(null);

    const action = await identity.handleInbound(inbound({ text: "Bonjour" }));

    expect(action).toEqual({ kind: "bridge", channelIdentityId: "ci-1", lang: "FR" });
  });

  it("stays silent for a BLOCKED identity", async () => {
    idMockPrisma.channelIdentity.upsert.mockResolvedValue(identityRow({ status: "BLOCKED" }));

    const action = await identity.handleInbound(inbound({ text: "Bonjour" }));

    expect(action).toEqual({ kind: "silent", reason: "blocked" });
  });
});

describe("unlinkChannelIdentity", () => {
  it("clears the link, resets status and audits", async () => {
    idMockPrisma.channelIdentity.findUnique.mockResolvedValue(
      identityRow({ status: "LINKED", candidateId: "cand-1", linkedVia: "TOKEN" }),
    );

    await expect(identity.unlinkChannelIdentity("ci-1")).resolves.toBe(true);
    expect(idMockPrisma.channelIdentity.update).toHaveBeenCalledWith({
      where: { id: "ci-1" },
      data: { candidateId: null, status: "PENDING", linkedVia: null },
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "channel.unlink" }),
    );
  });

  it("detaches the claimed conversation and re-arms the cap notice", async () => {
    idMockPrisma.channelIdentity.findUnique.mockResolvedValue(
      identityRow({
        status: "LINKED",
        candidateId: "cand-1",
        linkedVia: "TOKEN",
        pendingExtract: {
          __anonTurns: 16,
          __capNotice: { scope: "anon", at: new Date().toISOString() },
        },
      }),
    );

    await expect(identity.unlinkChannelIdentity("ci-1")).resolves.toBe(true);

    // Post-unlink anonymous messages must not resume the candidate's thread.
    expect(idMockPrisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { channelIdentityId: "ci-1", candidateId: { not: null } },
      data: { channelIdentityId: null },
    });
    // __capNotice cleared (one fresh linkRequired notice), __anonTurns kept
    // (linking is still required past the anonymous cap).
    const reservedWrite = idMockPrisma.channelIdentity.update.mock.calls.find(
      (c: AnyRecord[]) =>
        (c[0] as { data: { pendingExtract?: unknown } }).data.pendingExtract !== undefined,
    );
    expect(reservedWrite).toBeDefined();
    expect(reservedWrite![0].data.pendingExtract.__capNotice).toBeUndefined();
    expect(reservedWrite![0].data.pendingExtract.__anonTurns).toBe(16);
  });

  it("returns false for an identity that is not linked", async () => {
    idMockPrisma.channelIdentity.findUnique.mockResolvedValue(identityRow());
    await expect(identity.unlinkChannelIdentity("ci-1")).resolves.toBe(false);
  });
});
