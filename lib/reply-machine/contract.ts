// VENDORED copy of the reply-machine engine contract (projects/reply-machine/src/contract.ts).
// mgwork is a separate repo, so the contract is vendored rather than imported. CONTRACT_VERSION
// must match the engine's; the engine's TenantResolver.register() refuses a mismatch.
export const CONTRACT_VERSION = "1.0.0";

export type Channel = "facebook" | "instagram" | "tiktok" | "whatsapp" | "web";

export interface ChannelBinding {
  channel: Channel;
  externalId: string;
}

export interface ProjectManifest {
  projectId: string;
  displayName: string;
  contractVersion: string;
  channels: ChannelBinding[];
}

export type JSONSchema = Record<string, unknown>;

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  access: "read" | "write";
}

export interface CallContext {
  projectId: string;
  channel: string;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ContextChunk {
  text: string;
  score?: number;
}

export interface ReplyPolicy {
  systemPromptFragment: string;
  autoReply: Partial<Record<Channel, boolean>>;
  escalateToHumanWhen?: string[];
  escalateToBiggerModelWhen?: string[];
  maxToolCallsPerReply?: number;
}

export interface RoutingModule {
  manifest(): ProjectManifest;
  retrieveContext(query: string, opts: { topK: number }): Promise<ContextChunk[]>;
  listTools(): ToolSpec[];
  callTool(name: string, args: Record<string, unknown>, ctx: CallContext): Promise<ToolResult>;
  policy(): ReplyPolicy;
}
