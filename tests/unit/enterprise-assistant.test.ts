// Unit tests for lib/social/enterprise-assistant.ts.
//
// Same mocking pattern as llm-bridge.test.ts: @/lib/prisma and @/lib/claude
// are mocked before the module under test is imported.

const entMockPrisma = {
  enterprise: {
    findUnique: jest.fn() as jest.Mock,
  },
  application: {
    groupBy: jest.fn() as jest.Mock,
  },
  conversation: {
    findUnique: jest.fn() as jest.Mock,
    create: jest.fn() as jest.Mock,
    update: jest.fn() as jest.Mock,
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: entMockPrisma,
}));

const entMockChatWithEscalation = jest.fn() as jest.Mock;

jest.mock("@/lib/claude", () => ({
  chat: jest.fn(),
  chatWithEscalation: entMockChatWithEscalation,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const assistant = require("@/lib/social/enterprise-assistant");

const ENTERPRISE_ROW = {
  id: "ent-1",
  companyName: "Beachcomber Ltd",
  sector: "hospitality",
  contactName: "Jane Doe",
  plan: "FREE",
  verified: true,
  jobOffers: [
    {
      title: "Chef de partie",
      status: "ACTIVE",
      sector: "hospitality",
      location: "Mauritius",
      slots: 2,
      _count: { applications: 5 },
    },
  ],
};

const PIPELINE = [
  { status: "APPLIED", _count: { _all: 4 } },
  { status: "SHORTLISTED", _count: { _all: 2 } },
];

beforeEach(() => {
  jest.clearAllMocks();
  entMockPrisma.enterprise.findUnique.mockResolvedValue(ENTERPRISE_ROW);
  entMockPrisma.application.groupBy.mockResolvedValue(PIPELINE);
  entMockPrisma.conversation.findUnique.mockResolvedValue({ id: "conv-1", history: [] });
  entMockPrisma.conversation.update.mockResolvedValue({});
});

describe("processEnterprise", () => {
  it("grounds the system prompt in the enterprise's offers and pipeline counts", async () => {
    entMockChatWithEscalation.mockResolvedValue({
      text: "You have one active offer.",
      stopReason: "end_turn",
      usage: { input: 10, output: 5 },
      escalated: false,
    });

    const result = await assistant.processEnterprise({
      enterpriseId: "ent-1",
      incomingText: "How are my offers doing?",
      lang: "EN",
    });

    expect(result).toEqual({
      ok: true,
      reply: "You have one active offer.",
      escalated: false,
    });
    const { system } = entMockChatWithEscalation.mock.calls[0][0];
    expect(system).toContain("company: Beachcomber Ltd");
    expect(system).toContain('"Chef de partie" — ACTIVE');
    expect(system).toContain("applications: 5");
    expect(system).toContain("SHORTLISTED: 2");
    expect(system).toContain("Respond concisely in English.");
  });

  it("passes the escalated flag through and persists both turns", async () => {
    entMockChatWithEscalation.mockResolvedValue({
      text: "Answer.",
      stopReason: "end_turn",
      usage: { input: 10, output: 5 },
      escalated: true,
    });

    const result = await assistant.processEnterprise({
      enterpriseId: "ent-1",
      incomingText: "Question?",
      lang: "FR",
    });

    expect(result).toMatchObject({ ok: true, escalated: true });
    expect(entMockPrisma.conversation.update).toHaveBeenCalledTimes(1);
    const { data } = entMockPrisma.conversation.update.mock.calls[0][0];
    expect(data.history).toHaveLength(2);
    expect(data.history[0]).toMatchObject({ role: "user", text: "Question?" });
    expect(data.history[1]).toMatchObject({ role: "assistant", text: "Answer." });
  });

  it("persists the user turn and returns api-error when the LLM fails", async () => {
    entMockChatWithEscalation.mockResolvedValue({
      error: "api-error",
      message: "boom",
      escalated: true,
    });

    const result = await assistant.processEnterprise({
      enterpriseId: "ent-1",
      incomingText: "Question?",
      lang: "FR",
    });

    expect(result).toEqual({ ok: false, error: "api-error", message: "boom" });
    expect(entMockPrisma.conversation.update).toHaveBeenCalledTimes(1);
    expect(entMockPrisma.conversation.update.mock.calls[0][0].data.history).toHaveLength(1);
  });

  it("returns enterprise-missing when the row does not exist", async () => {
    entMockPrisma.enterprise.findUnique.mockResolvedValue(null);
    const result = await assistant.processEnterprise({
      enterpriseId: "nope",
      incomingText: "hello",
      lang: "FR",
    });
    expect(result).toEqual({ ok: false, error: "enterprise-missing" });
  });
});
