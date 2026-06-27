// Read-only DB tools — tenant scoping + PII safety.
// Mock @/lib/prisma BEFORE importing the module under test (same idiom as
// llm-bridge.test.ts). `../prisma` and `@/lib/prisma` resolve to one file.

const mockPrisma = {
  application: { findMany: jest.fn() as jest.Mock },
  jobOffer: { findUnique: jest.fn() as jest.Mock },
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { callMgworkTool } from "@/lib/reply-machine/tools";
import type { CallContext } from "@/lib/reply-machine/contract";

const baseCtx: CallContext = { projectId: "mgwork", channel: "web" };

describe("get_candidate_status", () => {
  it("returns linked:false and does NOT touch the DB when no ctx candidate", async () => {
    const r = await callMgworkTool("get_candidate_status", {}, baseCtx);
    expect(r).toEqual({ ok: true, data: { linked: false, hint: expect.any(String) } });
    expect(mockPrisma.application.findMany).not.toHaveBeenCalled();
  });

  it("scopes the query to ctx.candidateId and maps results", async () => {
    mockPrisma.application.findMany.mockResolvedValueOnce([
      {
        status: "APPLIED",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        jobOffer: { title: "Welder", sector: "Construction" },
      },
    ]);
    const r = await callMgworkTool("get_candidate_status", {}, { ...baseCtx, candidateId: "cand-1" });
    expect(mockPrisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { candidateId: "cand-1" } }),
    );
    expect(r.ok).toBe(true);
    const data = r.data as { linked: boolean; applications: unknown[] };
    expect(data.linked).toBe(true);
    expect(data.applications[0]).toMatchObject({ offer: "Welder", sector: "Construction", status: "APPLIED" });
  });

  it("IGNORES a model-supplied candidateId — uses ctx only (cross-tenant guard)", async () => {
    mockPrisma.application.findMany.mockResolvedValueOnce([]);
    await callMgworkTool("get_candidate_status", { candidateId: "victim-id" }, { ...baseCtx, candidateId: "cand-1" });
    expect(mockPrisma.application.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { candidateId: "cand-1" } }),
    );
  });
});

describe("get_job_offer", () => {
  const ACTIVE = {
    id: "o1",
    title: "X",
    description: "d",
    sector: "s",
    location: "Maurice",
    slots: 1,
    status: "ACTIVE",
    requirements: [],
    langRequired: [],
  };

  it("returns public fields for an ACTIVE offer, no enterpriseId/PII", async () => {
    mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(ACTIVE);
    const r = await callMgworkTool("get_job_offer", { offerId: "o1" }, baseCtx);
    expect(r.ok).toBe(true);
    expect(r.data).not.toHaveProperty("enterpriseId");
    expect((r.data as { id: string }).id).toBe("o1");
  });

  it("hides a non-ACTIVE offer (treated as absent)", async () => {
    mockPrisma.jobOffer.findUnique.mockResolvedValueOnce({ ...ACTIVE, status: "DRAFT" });
    const r = await callMgworkTool("get_job_offer", { offerId: "o1" }, baseCtx);
    expect(r).toEqual({ ok: false, error: "offer not found" });
  });

  it("returns not-found for a missing offer", async () => {
    mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(null);
    const r = await callMgworkTool("get_job_offer", { offerId: "nope" }, baseCtx);
    expect(r).toEqual({ ok: false, error: "offer not found" });
  });

  it("requires offerId and does not query without it", async () => {
    const r = await callMgworkTool("get_job_offer", {}, baseCtx);
    expect(r).toEqual({ ok: false, error: "offerId is required" });
    expect(mockPrisma.jobOffer.findUnique).not.toHaveBeenCalled();
  });
});

describe("callMgworkTool", () => {
  it("rejects an unknown tool", async () => {
    const r = await callMgworkTool("nope", {}, baseCtx);
    expect(r.ok).toBe(false);
  });
});
