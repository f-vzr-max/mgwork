// Mock @/lib/prisma BEFORE importing the matching module so the import binds
// to the mock. Each test resets the mock implementations.

const matchingMockPrisma = {
  jobOffer: {
    findUnique: jest.fn() as jest.Mock,
    findMany: jest.fn() as jest.Mock,
    count: jest.fn() as jest.Mock,
  },
  candidate: {
    findUnique: jest.fn() as jest.Mock,
    findMany: jest.fn() as jest.Mock,
  },
  matching: {
    deleteMany: jest.fn() as jest.Mock,
    create: jest.fn() as jest.Mock,
  },
  $transaction: jest.fn() as jest.Mock,
};

jest.mock("@/lib/prisma", () => ({
  prisma: matchingMockPrisma,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const matching = require("@/lib/matching");

beforeEach(() => {
  jest.clearAllMocks();
});

const offerRow = {
  id: "offer-1",
  sector: "construction",
  requirements: ["welding", "safety"],
  langRequired: ["FR"],
};

function makeCandRow(id: string, opts: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    firstName: "First",
    lastName: "Last",
    dateOfBirth: new Date("1990-01-01"),
    nationality: "MG",
    phone: "+261341234567",
    city: "Tana",
    langScoreFR: 100,
    langScoreEN: 80,
    cvFileUrl: "https://example.com/cv.pdf",
    bio: "experienced",
    skills: ["welding", "safety"],
    sectors: ["construction"],
    documents: [{ type: "PASSPORT" }, { type: "MEDICAL_AUTHORIZATION" }],
    ...opts,
  };
}

describe("rankCandidatesForOffer", () => {
  it("returns top-N candidates sorted by score desc", async () => {
    matchingMockPrisma.jobOffer.findUnique.mockResolvedValue(offerRow);
    matchingMockPrisma.candidate.findMany.mockResolvedValue([
      makeCandRow("c1"),
      makeCandRow("c2", {
        skills: ["accounting"],
        sectors: ["finance"],
        langScoreFR: 0,
        documents: [],
      }),
      makeCandRow("c3", { skills: ["welding"], documents: [{ type: "PASSPORT" }] }),
    ]);

    const result = await matching.rankCandidatesForOffer("offer-1", undefined, 5);
    expect(result).toHaveLength(3);
    expect(result[0].candidateId).toBe("c1");
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("respects the limit", async () => {
    matchingMockPrisma.jobOffer.findUnique.mockResolvedValue(offerRow);
    matchingMockPrisma.candidate.findMany.mockResolvedValue([
      makeCandRow("c1"),
      makeCandRow("c2"),
      makeCandRow("c3"),
    ]);

    const result = await matching.rankCandidatesForOffer("offer-1", undefined, 2);
    expect(result).toHaveLength(2);
  });

  it("returns [] when offer not found", async () => {
    matchingMockPrisma.jobOffer.findUnique.mockResolvedValue(null);
    const result = await matching.rankCandidatesForOffer("nope");
    expect(result).toEqual([]);
    expect(matchingMockPrisma.candidate.findMany).not.toHaveBeenCalled();
  });
});

describe("recomputeMatchings", () => {
  it("wipes prior matchings and inserts top-N", async () => {
    matchingMockPrisma.jobOffer.findUnique.mockResolvedValue(offerRow);
    matchingMockPrisma.candidate.findMany.mockResolvedValue([
      makeCandRow("c1"),
      makeCandRow("c2"),
    ]);
    matchingMockPrisma.matching.deleteMany.mockReturnValue({ kind: "deleteMany" });
    matchingMockPrisma.matching.create.mockImplementation((args: unknown) => ({
      kind: "create",
      args,
    }));
    matchingMockPrisma.$transaction.mockResolvedValue([]);

    const top = await matching.recomputeMatchings("offer-1", undefined, 5);
    expect(top).toHaveLength(2);
    expect(matchingMockPrisma.matching.deleteMany).toHaveBeenCalledWith({
      where: { jobOfferId: "offer-1" },
    });
    expect(matchingMockPrisma.matching.create).toHaveBeenCalledTimes(2);
    expect(matchingMockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("findOffersForCandidate", () => {
  it("returns [] when candidate not found", async () => {
    matchingMockPrisma.candidate.findUnique.mockResolvedValue(null);
    const result = await matching.findOffersForCandidate("nope");
    expect(result).toEqual([]);
  });

  it("ranks active offers", async () => {
    matchingMockPrisma.candidate.findUnique.mockResolvedValue(makeCandRow("c1"));
    matchingMockPrisma.jobOffer.findMany.mockResolvedValue([
      { ...offerRow, id: "o1" },
      { ...offerRow, id: "o2", sector: "hospitality" },
    ]);

    const result = await matching.findOffersForCandidate("c1");
    expect(result).toHaveLength(2);
    expect(result[0].offerId).toBe("o1");
    expect(matchingMockPrisma.jobOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } }),
    );
  });
});
