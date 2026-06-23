import type { ToolSpec, ToolResult, CallContext } from "./contract";

// Typed, READ-ONLY tool specs. inputSchema declares typed args only — no free-form SQL field.
export const MGWORK_TOOLS: ToolSpec[] = [
  {
    name: "get_job_offer",
    description: "Fetch a job offer by id (read-only).",
    access: "read",
    inputSchema: {
      type: "object",
      properties: { offerId: { type: "string" } },
      required: ["offerId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_candidate_status",
    description: "Fetch a candidate's application status by id (read-only).",
    access: "read",
    inputSchema: {
      type: "object",
      properties: { candidateId: { type: "string" } },
      required: ["candidateId"],
      additionalProperties: false,
    },
  },
];

export async function callMgworkTool(
  name: string,
  args: Record<string, unknown>,
  ctx: CallContext
): Promise<ToolResult> {
  // TODO(human): implement against Prisma (import @/lib/prisma, read-only). Bind typed args as
  // parameters and scope EVERY query to ctx.projectId. NEVER concatenate args or message text
  // into a SQL string. Return compact structured data, not raw table dumps.
  void args;
  void ctx;
  return { ok: false, error: `TODO(human): implement ${name} against Prisma (read-only, scoped to ctx.projectId)` };
}
