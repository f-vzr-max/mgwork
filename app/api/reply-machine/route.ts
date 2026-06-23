// Reply-machine routing-module endpoint (scaffold). NEW file — auto-discovered by the App
// Router, so it wires in with ZERO edits to existing files. It calls the MgworkRoutingModule
// directly; it does NOT import @reply-machine/engine (that would add a dependency = an edit to
// package.json). Full engine-pipeline wiring is Phase-3 TODO(human).
import { MgworkRoutingModule } from "@/lib/reply-machine";
import type { CallContext } from "@/lib/reply-machine/contract";

export const runtime = "nodejs";

const routingModule = new MgworkRoutingModule();

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const rec = (body ?? {}) as Record<string, unknown>;
  const text = typeof rec.text === "string" ? rec.text : "";
  if (!text) return Response.json({ ok: false, error: "missing text" }, { status: 400 });

  // projectId is set SERVER-SIDE, never read from the request body.
  const ctx: CallContext = { projectId: "mgwork", channel: "web" };
  const policy = routingModule.policy();
  const chunks = await routingModule.retrieveContext(text, { topK: 4 });

  return Response.json({
    ok: true,
    projectId: ctx.projectId,
    channel: ctx.channel,
    voice: policy.systemPromptFragment,
    contextCount: chunks.length,
    tools: routingModule.listTools().map((t) => t.name),
    note: "TODO(human): wire @reply-machine/engine run() pipeline + real model + auth",
  });
}
