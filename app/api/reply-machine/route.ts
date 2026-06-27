// Reply-machine endpoint — native, tool-augmented assistant for the web
// channel. Resolves the candidate SERVER-SIDE (Clerk session), runs the bounded
// tool loop (lib/reply-machine/pipeline) over the routing module's read-only
// tools, and returns a JSON reply. projectId/candidateId are never read from
// the body. Mirrors /api/chat's CSRF + rate-limit guards.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { AIDefenceError } from "@/lib/aidefence";
import { logAuditByClerkId } from "@/lib/audit";
import { MgworkRoutingModule } from "@/lib/reply-machine";
import { runReply } from "@/lib/reply-machine/pipeline";
import type { CallContext } from "@/lib/reply-machine/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 4000;
const routingModule = new MgworkRoutingModule();

function jsonError(error: string, status: number): Response {
  return NextResponse.json({ ok: false, error }, { status });
}

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) return jsonError("bad origin", 403);
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return jsonError("sign-in required", 401);

  if (!(await rateLimit(clerkId, "reply-machine.message", 30, 60))) {
    return jsonError("slow down", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid json", 400);
  }
  const rec = (body ?? {}) as Record<string, unknown>;
  const text = typeof rec.text === "string" ? rec.text.trim() : "";
  if (!text) return jsonError("missing text", 400);
  if (text.length > MAX_TEXT) return jsonError("text too long", 400);

  // candidateId is resolved from the session — NEVER from the body. Absent for
  // non-candidate users → tools degrade to the unlinked/anonymous path.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { candidate: { select: { id: true } } },
  });
  const ctx: CallContext = {
    projectId: "mgwork",
    channel: "web",
    candidateId: user?.candidate?.id,
  };

  // One audit row per request, written after the attempt — tracks AI usage and
  // abuse. Best-effort: never blocks the reply.
  const audit = (extra: Record<string, unknown>) =>
    logAuditByClerkId(clerkId, {
      action: "reply-machine.message",
      resourceType: "conversation",
      resourceId: ctx.candidateId,
      ipAddress: getIp(req),
      metadata: { length: text.length, channel: "web", ...extra },
    });

  try {
    const result = await runReply({ ctx, module: routingModule, incomingText: text });
    if (!result.ok) {
      await audit({ ok: false, error: result.error });
      // Never forward provider error text to the client.
      return jsonError(
        result.error === "no-key" ? "assistant unavailable" : "assistant error",
        result.error === "no-key" ? 503 : 502,
      );
    }
    await audit({ ok: true, toolCalls: result.toolCalls });
    return NextResponse.json({ ok: true, reply: result.reply, toolCalls: result.toolCalls });
  } catch (e) {
    if (e instanceof AIDefenceError) {
      await audit({ ok: false, rejected: "aidefence" });
      return jsonError("rejected by safety filter", 400);
    }
    console.error("reply-machine: unhandled", e);
    await audit({ ok: false, error: "exception" });
    return jsonError("assistant error", 500);
  }
}
