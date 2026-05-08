// In-app chat endpoint — server-sent events.
//
// Contract: docs/contracts.md row "POST /api/chat".
//   - Auth: signed-in CANDIDATE.
//   - Body: chatMessageSchema (strict zod).
//   - Audit: chat.message_send
//   - Rate limit: 30 / 60s per Clerk userId.
//
// Wire format: text/event-stream. We stream three event types:
//   - event: meta   data: { extracted: {...} | null }
//   - event: chunk  data: { text: "<delta>" }
//   - event: done   data: {}
//   - event: error  data: { code, message }
//
// We currently call the bridge end-to-end then emit one `chunk` event with
// the full reply, followed by `done`. Switching to true token-streaming is
// just a matter of wiring the Anthropic stream API into `lib/claude.ts`; the
// SSE protocol on the wire stays the same.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { AIDefenceError } from "@/lib/aidefence";
import { chatMessageSchema } from "@/lib/validation/chat";
import { process as bridgeProcess, type BridgeLang } from "@/lib/social/llm-bridge";
import { err } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

function sseEvent(event: string, data: unknown): string {
  const payload = JSON.stringify(data ?? {});
  return `event: ${event}\ndata: ${payload}\n\n`;
}

function sseStream(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

function jsonError(code: Parameters<typeof err>[0], message: string, status: number) {
  return NextResponse.json(err(code, message), { status });
}

export async function POST(req: Request) {
  // 1) CSRF defense-in-depth.
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return jsonError("FORBIDDEN", "Bad origin", 403);
    }
    throw e;
  }

  // 2) Clerk session.
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return jsonError("UNAUTHORIZED", "Sign-in required", 401);
  }

  // 3) Rate limit (30 per minute per user).
  const allowed = await rateLimit(clerkId, "chat.message", 30, 60);
  if (!allowed) {
    return jsonError("RATE_LIMITED", "Slow down", 429);
  }

  // 4) Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "Body must be JSON", 400);
  }

  let parsed;
  try {
    parsed = chatMessageSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid chat payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  // 5) Resolve User → Candidate. Role gate is CANDIDATE (admins use other tools).
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      lang: true,
      candidate: { select: { id: true } },
    },
  });
  if (!user) {
    return jsonError("NOT_FOUND", "User profile not yet synced", 404);
  }
  if (user.role !== "CANDIDATE") {
    return jsonError("FORBIDDEN", "Only candidates can use this chat", 403);
  }
  if (!user.candidate) {
    return jsonError("NOT_FOUND", "Complete onboarding first", 404);
  }

  const lang = ((parsed.lang ?? user.lang) as BridgeLang) ?? "FR";

  // 6) Audit BEFORE we hand off to the bridge so we have a record even if the
  // upstream LLM call fails. Best-effort — never blocks.
  await logAuditByClerkId(clerkId, {
    action: "chat.message_send",
    resourceType: "conversation",
    resourceId: user.candidate.id,
    ipAddress: getIp(req),
    metadata: { length: parsed.text.length, lang },
  });

  // 7) Run the bridge (which itself runs `assertSafeForLLM` first).
  let bridgeResult;
  try {
    bridgeResult = await bridgeProcess({
      candidateId: user.candidate.id,
      incomingText: parsed.text,
      lang,
    });
  } catch (e) {
    if (e instanceof AIDefenceError) {
      return jsonError(
        "VALIDATION_ERROR",
        "Message rejected by safety filter",
        400,
      );
    }
    return sseStream([
      sseEvent("error", {
        code: "INTERNAL_ERROR",
        message: e instanceof Error ? e.message.slice(0, 200) : "internal",
      }),
      sseEvent("done", {}),
    ]);
  }

  if (!bridgeResult.ok) {
    const code =
      bridgeResult.error === "no-key"
        ? "EXTERNAL_DEPENDENCY_FAILED"
        : bridgeResult.error === "candidate-missing"
          ? "NOT_FOUND"
          : "EXTERNAL_DEPENDENCY_FAILED";
    return sseStream([
      sseEvent("error", {
        code,
        message: bridgeResult.message ?? bridgeResult.error,
      }),
      sseEvent("done", {}),
    ]);
  }

  // 8) Stream a single chunk + done. (Token-streaming hook lives here later.)
  return sseStream([
    sseEvent("meta", { extracted: bridgeResult.extracted }),
    sseEvent("chunk", { text: bridgeResult.reply }),
    sseEvent("done", {}),
  ]);
}
