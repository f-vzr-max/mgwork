import type { ToolSpec, ToolResult, CallContext } from "./contract";
import { prisma } from "../prisma";

// Typed, READ-ONLY tools surfaced to the model. inputSchema declares typed args
// only — no free-form SQL field. Cross-candidate safety: get_candidate_status
// takes NO id; it resolves the candidate from ctx (server-set), so a
// prompt-injected caller cannot read another candidate's data.
export const MGWORK_TOOLS: ToolSpec[] = [
  {
    name: "get_candidate_status",
    description:
      "Get the signed-in candidate's own job application statuses. Takes no arguments — the candidate is resolved from the session.",
    access: "read",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_job_offer",
    description: "Get public details of an ACTIVE job offer by its id.",
    access: "read",
    inputSchema: {
      type: "object",
      properties: { offerId: { type: "string", description: "The job offer id." } },
      required: ["offerId"],
      additionalProperties: false,
    },
  },
];

export async function callMgworkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: CallContext,
): Promise<ToolResult> {
  switch (name) {
    case "get_candidate_status":
      return getCandidateStatus(ctx);
    case "get_job_offer":
      return getJobOffer(args);
    default:
      return { ok: false, error: `unknown tool: ${name}` };
  }
}

// Scoped to ctx.candidateId ONLY — never an arg. No candidate id in scope means
// an unlinked/anonymous caller: return a hint, never a DB read.
async function getCandidateStatus(ctx: CallContext): Promise<ToolResult> {
  if (!ctx.candidateId) {
    return {
      ok: true,
      data: { linked: false, hint: "Sign in or link your account to see your application status." },
    };
  }
  const apps = await prisma.application.findMany({
    where: { candidateId: ctx.candidateId },
    orderBy: { updatedAt: "desc" },
    take: 25,
    select: {
      status: true,
      updatedAt: true,
      jobOffer: { select: { title: true, sector: true } },
    },
  });
  return {
    ok: true,
    data: {
      linked: true,
      applications: apps.map((a) => ({
        offer: a.jobOffer?.title ?? "—",
        sector: a.jobOffer?.sector ?? null,
        status: a.status,
        updatedAt: a.updatedAt.toISOString(),
      })),
    },
  };
}

// Public offer info only. Non-ACTIVE offers are not public → treated as absent.
// Never returns enterpriseId, applicants, or any PII.
async function getJobOffer(args: Record<string, unknown>): Promise<ToolResult> {
  const offerId = typeof args.offerId === "string" ? args.offerId.trim() : "";
  if (!offerId) return { ok: false, error: "offerId is required" };
  const offer = await prisma.jobOffer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      title: true,
      description: true,
      sector: true,
      location: true,
      slots: true,
      status: true,
      requirements: true,
      langRequired: true,
    },
  });
  if (!offer || offer.status !== "ACTIVE") return { ok: false, error: "offer not found" };
  return { ok: true, data: offer };
}
