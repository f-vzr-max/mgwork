// Enterprise assistant — turns one ENTERPRISE user message into one reply.
//
// Unlike the candidate bridge there is no field extraction: the assistant is
// read-only over the enterprise's own data. The system prompt is rebuilt per
// message from the Enterprise row + its JobOffers + application pipeline
// counts, so answers always reflect current state. Transcripts persist on the
// generalized Conversation row keyed [enterpriseId, platform=IN_APP].
//
// Model policy: fast/Haiku first with ONE smart retry via chatWithEscalation
// — same rule as the candidate bridge.

import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { chatWithEscalation } from "../claude";
import { assertSafeForLLM } from "../aidefence";
import type { ConversationMessage } from "./types";
import {
  clipHistory,
  isUniqueViolation,
  localeLabel,
  readHistory,
  toChatMessages,
  type BridgeLang,
} from "./llm-bridge";

export type EnterpriseAssistantResult =
  | { ok: true; reply: string; escalated: boolean }
  | { ok: false; error: "no-key" | "api-error" | "enterprise-missing"; message?: string };

// Cap how many offers we inline into the prompt — enough for any realistic
// account on the current plans without blowing the token budget.
const MAX_PROMPT_OFFERS = 20;

const SYSTEM_PROMPT_TEMPLATE = `You are AsanaoConnect's assistant for employer accounts on the AsanaoConnect platform (recruiting Malagasy candidates for jobs in Mauritius). Help this enterprise manage its job offers, applications, shortlists, interviews and required documents, and answer questions about how the platform works.
Ground every answer in the enterprise data below — it is the ONLY account you may discuss. Politely refuse questions about other companies or about candidate data you do not see here. Never invent offers, counts or candidate details.
Respond concisely in {{lang}}.

{{data}}`;

type EnterpriseRow = {
  companyName: string;
  sector: string | null;
  contactName: string | null;
  plan: string;
  verified: boolean;
  jobOffers: {
    title: string;
    status: string;
    sector: string;
    location: string;
    slots: number;
    _count: { applications: number };
  }[];
};

type PipelineCount = { status: string; count: number };

function buildEnterpriseSystemPrompt(
  enterprise: EnterpriseRow,
  pipeline: PipelineCount[],
  lang: BridgeLang,
): string {
  const lines: string[] = [];
  lines.push("Enterprise account:");
  lines.push(`- company: ${enterprise.companyName}`);
  if (enterprise.sector) lines.push(`- sector: ${enterprise.sector}`);
  if (enterprise.contactName) lines.push(`- contact: ${enterprise.contactName}`);
  lines.push(`- plan: ${enterprise.plan}, verified: ${enterprise.verified ? "yes" : "no"}`);
  lines.push("");
  lines.push(`Job offers (latest ${MAX_PROMPT_OFFERS}):`);
  if (enterprise.jobOffers.length === 0) {
    lines.push("- none yet");
  } else {
    for (const o of enterprise.jobOffers) {
      lines.push(
        `- "${o.title}" — ${o.status}, sector ${o.sector}, ${o.location}, slots: ${o.slots}, applications: ${o._count.applications}`,
      );
    }
  }
  lines.push("");
  lines.push("Applications by status (all offers, SHORTLISTED = shortlist):");
  if (pipeline.length === 0) {
    lines.push("- none yet");
  } else {
    for (const p of pipeline) lines.push(`- ${p.status}: ${p.count}`);
  }
  return SYSTEM_PROMPT_TEMPLATE.replace("{{lang}}", localeLabel(lang)).replace(
    "{{data}}",
    lines.join("\n"),
  );
}

// Load (or create) the IN_APP conversation row for this enterprise. Two
// concurrent first messages can race the create — the loser catches P2002 and
// re-reads the winner's row instead of surfacing an SSE error.
async function loadEnterpriseConversation(enterpriseId: string): Promise<{
  id: string;
  history: ConversationMessage[];
}> {
  const existing = await prisma.conversation.findUnique({
    where: {
      enterpriseId_platform: { enterpriseId, platform: "IN_APP" },
    },
    select: { id: true, history: true },
  });
  if (existing) {
    return { id: existing.id, history: readHistory(existing.history) };
  }
  try {
    const created = await prisma.conversation.create({
      data: {
        enterpriseId,
        platform: "IN_APP",
        history: [] as Prisma.InputJsonValue,
      },
      select: { id: true, history: true },
    });
    return { id: created.id, history: [] };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const winner = await prisma.conversation.findUnique({
      where: { enterpriseId_platform: { enterpriseId, platform: "IN_APP" } },
      select: { id: true, history: true },
    });
    if (!winner) throw e;
    return { id: winner.id, history: readHistory(winner.history) };
  }
}

async function persistConversation(
  conversationId: string,
  history: ConversationMessage[],
): Promise<void> {
  const clipped = clipHistory(history);
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { history: clipped as unknown as Prisma.InputJsonValue },
  });
}

export type ProcessEnterpriseParams = {
  enterpriseId: string;
  incomingText: string;
  lang: BridgeLang;
};

// Main entry point. Throws AIDefenceError when the input is unsafe — the
// caller (route handler) is responsible for catching and returning 400.
export async function processEnterprise(
  params: ProcessEnterpriseParams,
): Promise<EnterpriseAssistantResult> {
  assertSafeForLLM(params.incomingText);

  const enterprise = await prisma.enterprise.findUnique({
    where: { id: params.enterpriseId },
    select: {
      id: true,
      companyName: true,
      sector: true,
      contactName: true,
      plan: true,
      verified: true,
      jobOffers: {
        select: {
          title: true,
          status: true,
          sector: true,
          location: true,
          slots: true,
          _count: { select: { applications: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_PROMPT_OFFERS,
      },
    },
  });
  if (!enterprise) {
    return { ok: false, error: "enterprise-missing" };
  }

  // Application pipeline counts across ALL of this enterprise's offers (the
  // SHORTLISTED row doubles as the shortlist count).
  const grouped = await prisma.application.groupBy({
    by: ["status"],
    where: { jobOffer: { enterpriseId: params.enterpriseId } },
    _count: { _all: true },
  });
  const pipeline: PipelineCount[] = grouped.map((g) => ({
    status: g.status,
    count: g._count._all,
  }));

  const conv = await loadEnterpriseConversation(params.enterpriseId);
  const userTurn: ConversationMessage = {
    role: "user",
    text: params.incomingText,
    at: new Date().toISOString(),
  };
  const transcript = [...conv.history, userTurn];

  const result = await chatWithEscalation({
    system: buildEnterpriseSystemPrompt(enterprise, pipeline, params.lang),
    messages: toChatMessages(transcript),
    maxTokens: 1024,
    validate: (res) => res.text.trim().length > 0,
  });

  if ("error" in result) {
    // Persist the user turn even on failure so the UI can show their message.
    await persistConversation(conv.id, transcript).catch(() => {
      /* swallow */
    });
    if (result.error === "no-key") {
      return { ok: false, error: "no-key" };
    }
    return { ok: false, error: "api-error", message: result.message };
  }

  const reply = result.text.trim();
  const assistantTurn: ConversationMessage = {
    role: "assistant",
    text: reply,
    at: new Date().toISOString(),
  };
  await persistConversation(conv.id, [...transcript, assistantTurn]);

  return { ok: true, reply, escalated: result.escalated };
}

// Convenience: read the IN_APP transcript for an enterprise without sending a
// new message. Used by the enterprise chat page server render.
export async function loadEnterpriseTranscript(
  enterpriseId: string,
): Promise<ConversationMessage[]> {
  const row = await prisma.conversation.findUnique({
    where: { enterpriseId_platform: { enterpriseId, platform: "IN_APP" } },
    select: { history: true },
  });
  if (!row) return [];
  return clipHistory(readHistory(row.history));
}
