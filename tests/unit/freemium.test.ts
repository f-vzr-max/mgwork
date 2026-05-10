// Mock prisma before importing billing.

const billingMockPrisma = {
  enterprise: {
    findUnique: jest.fn() as jest.Mock,
  },
  jobOffer: {
    count: jest.fn() as jest.Mock,
  },
};

jest.mock("@/lib/prisma", () => ({
  prisma: billingMockPrisma,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const billing = require("@/lib/billing");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canCreateOffer — FREE plan", () => {
  it("allows when 0 active offers", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "FREE" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(0);
    expect(await billing.canCreateOffer("ent-1")).toBe(true);
  });

  it("allows when 1 active offer", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "FREE" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(1);
    expect(await billing.canCreateOffer("ent-1")).toBe(true);
  });

  it("allows when 2 active offers (under limit of 3)", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "FREE" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(2);
    expect(await billing.canCreateOffer("ent-1")).toBe(true);
  });

  it("blocks when 3 active offers (at limit)", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "FREE" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(3);
    expect(await billing.canCreateOffer("ent-1")).toBe(false);
  });

  it("blocks when 4 active offers (over limit)", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "FREE" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(4);
    expect(await billing.canCreateOffer("ent-1")).toBe(false);
  });
});

describe("canCreateOffer — PRO plan", () => {
  it("always allows on PRO regardless of count", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "PRO" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(50);
    expect(await billing.canCreateOffer("ent-1")).toBe(true);
  });

  it("always allows on STARTER regardless of count", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "STARTER" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(10);
    expect(await billing.canCreateOffer("ent-1")).toBe(true);
  });
});

describe("canCreateOffer — fail-closed", () => {
  it("returns false when enterprise not found", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue(null);
    expect(await billing.canCreateOffer("missing")).toBe(false);
  });
});

describe("getOfferQuota", () => {
  it("returns null when enterprise not found", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue(null);
    expect(await billing.getOfferQuota("missing")).toBeNull();
  });

  it("reports remaining slots for FREE", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "FREE" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(2);
    const q = await billing.getOfferQuota("ent-1");
    expect(q).toEqual({
      plan: "FREE",
      limit: 3,
      active: 2,
      remaining: 1,
      canCreate: true,
    });
  });

  it("reports unlimited for paid plans", async () => {
    billingMockPrisma.enterprise.findUnique.mockResolvedValue({ plan: "PRO" });
    billingMockPrisma.jobOffer.count.mockResolvedValue(7);
    const q = await billing.getOfferQuota("ent-1");
    expect(q).toEqual({
      plan: "PRO",
      limit: null,
      active: 7,
      remaining: null,
      canCreate: true,
    });
  });
});
