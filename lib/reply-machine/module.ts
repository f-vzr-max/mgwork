import type {
  RoutingModule,
  ProjectManifest,
  ContextChunk,
  ToolSpec,
  CallContext,
  ToolResult,
  ReplyPolicy,
} from "./contract";
import { CONTRACT_VERSION } from "./contract";
import { MGWORK_TOOLS, callMgworkTool } from "./tools";

/**
 * mgwork (AsanaoConnect) Routing Module — thin, read-only adapter to the Universal Reply Engine.
 * New files only: imports the repo's existing data layer read-only when implemented; never edits it.
 */
export class MgworkRoutingModule implements RoutingModule {
  manifest(): ProjectManifest {
    return {
      projectId: "mgwork",
      displayName: "AsanaoConnect",
      contractVersion: CONTRACT_VERSION,
      channels: [{ channel: "web", externalId: process.env.MGWORK_WIDGET_KEY ?? "dev-widget" }],
    };
  }

  async retrieveContext(_query: string, _opts: { topK: number }): Promise<ContextChunk[]> {
    // TODO(human): wire to existing lib/social/memory.ts / help content (import read-only).
    return [];
  }

  listTools(): ToolSpec[] {
    return MGWORK_TOOLS;
  }

  async callTool(name: string, args: Record<string, unknown>, ctx: CallContext): Promise<ToolResult> {
    // Cross-tenant guard is the FIRST statement, before any arg/schema validation.
    if (ctx.projectId !== "mgwork") return { ok: false, error: "tenant mismatch" };
    return callMgworkTool(name, args, ctx);
  }

  policy(): ReplyPolicy {
    return {
      systemPromptFragment:
        "Tu es l'assistant AsanaoConnect. Reponds en francais, de facon professionnelle et accessible aux novices comme aux experts.",
      autoReply: { web: true },
      escalateToBiggerModelWhen: ["complex", "low confidence"],
      escalateToHumanWhen: ["refund", "legal", "dispute"],
      maxToolCallsPerReply: 4,
    };
  }
}
