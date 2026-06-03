// Mock every external dependency BEFORE importing the route so the route binds
// to the mocks. The route imports next/headers, svix, @clerk/nextjs/server,
// @/lib/prisma and @/lib/config. We drive the handler end-to-end and assert on
// the prisma write path, focusing on the re-link-by-email branch (the bug fix).

const webhookMockPrisma = {
  user: {
    findUnique: jest.fn() as jest.Mock,
    update: jest.fn() as jest.Mock,
    create: jest.fn() as jest.Mock,
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: webhookMockPrisma,
}));

// svix verify just returns the parsed body as the event.
const svixVerify = jest.fn();
jest.mock("svix", () => ({
  Webhook: jest.fn().mockImplementation(() => ({ verify: svixVerify })),
}));

// Provide the three svix headers the route requires.
jest.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) =>
      ({
        "svix-id": "msg_1",
        "svix-timestamp": "1700000000",
        "svix-signature": "v1,sig",
      } as Record<string, string>)[name] ?? null,
  }),
}));

const updateUserMetadata = jest.fn().mockResolvedValue(undefined);
jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest
    .fn()
    .mockResolvedValue({ users: { updateUserMetadata } }),
}));

jest.mock("@/lib/config", () => ({
  env: { clerkWebhookSecret: () => "whsec_test" },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require("@/app/api/webhooks/clerk/route");

function makeRequest(event: unknown): Request {
  return { text: async () => JSON.stringify(event) } as unknown as Request;
}

function userEvent(
  type: string,
  clerkId: string,
  email: string
): Record<string, unknown> {
  return {
    type,
    data: {
      id: clerkId,
      email_addresses: [{ id: "e1", email_address: email }],
      primary_email_address_id: "e1",
      public_metadata: {},
      unsafe_metadata: {},
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  svixVerify.mockImplementation((body: string) => JSON.parse(body));
  webhookMockPrisma.user.update.mockResolvedValue({});
  webhookMockPrisma.user.create.mockResolvedValue({});
});

describe("clerk webhook — reconcile by email", () => {
  it("re-links an orphaned row to the new clerkId when a recreated user shares the email", async () => {
    // No row for the new clerkId, but a row exists for the email (old clerkId).
    webhookMockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // lookup by clerkId
      .mockResolvedValueOnce({
        id: "row1",
        clerkId: "clerk_OLD",
        email: "sam@example.com",
      }); // lookup by email

    const res = await POST(
      makeRequest(userEvent("user.created", "clerk_NEW", "sam@example.com"))
    );

    expect(res.status).toBe(200);
    // It must UPDATE the existing row to the new clerkId, not create a duplicate.
    expect(webhookMockPrisma.user.create).not.toHaveBeenCalled();
    expect(webhookMockPrisma.user.update).toHaveBeenCalledWith({
      where: { email: "sam@example.com" },
      data: { clerkId: "clerk_NEW", role: "CANDIDATE", lang: "FR" },
    });
  });

  it("updates by clerkId when the row already matches (normal returning user)", async () => {
    webhookMockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "row1",
      clerkId: "clerk_NEW",
      email: "sam@example.com",
    });

    const res = await POST(
      makeRequest(userEvent("user.updated", "clerk_NEW", "sam@example.com"))
    );

    expect(res.status).toBe(200);
    expect(webhookMockPrisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_NEW" },
      data: { email: "sam@example.com", role: "CANDIDATE", lang: "FR" },
    });
    expect(webhookMockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("creates a fresh row when neither clerkId nor email exists", async () => {
    webhookMockPrisma.user.findUnique
      .mockResolvedValueOnce(null) // by clerkId
      .mockResolvedValueOnce(null); // by email

    const res = await POST(
      makeRequest(userEvent("user.created", "clerk_NEW", "new@example.com"))
    );

    expect(res.status).toBe(200);
    expect(webhookMockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        clerkId: "clerk_NEW",
        email: "new@example.com",
        role: "CANDIDATE",
        lang: "FR",
      },
    });
    expect(webhookMockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("is idempotent on webhook re-fire after a re-link (becomes a plain update)", async () => {
    // After the re-link, the row now matches the new clerkId on the next delivery.
    webhookMockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "row1",
      clerkId: "clerk_NEW",
      email: "sam@example.com",
    });

    const res = await POST(
      makeRequest(userEvent("user.updated", "clerk_NEW", "sam@example.com"))
    );

    expect(res.status).toBe(200);
    expect(webhookMockPrisma.user.create).not.toHaveBeenCalled();
    expect(webhookMockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(webhookMockPrisma.user.update).toHaveBeenCalledWith({
      where: { clerkId: "clerk_NEW" },
      data: { email: "sam@example.com", role: "CANDIDATE", lang: "FR" },
    });
  });
});
