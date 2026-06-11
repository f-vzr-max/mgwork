// MG Work — on-demand AI document analysis.
//
// POST /api/ai/analyze-doc  body: { documentId }
//   - Auth: STAFF_DOCUMENTS | STAFF_FOLLOWUP | ADMIN | SUPER_ADMIN
//   - Rate limit: 10 / 60s per Clerk userId (one vision call per hit).
//   - Audit: ai.analyze_doc
//
// (Re)runs the advisory classification from lib/ai/doc-analysis.ts and
// persists the verdict to Document.aiAnalysis. Read-only with respect to
// Document.status — staff decisions stay fully manual.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { canAccess, type Role } from "@/lib/roles";
import { analyzeDocumentById } from "@/lib/ai/doc-analysis";
import { env } from "@/lib/config";
import { err, ok } from "@/types/api";

const analyzeDocSchema = z.object({ documentId: z.string().cuid() }).strict();

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", "Bad origin"), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), { status: 401 });
  }

  const allowed = await rateLimit(clerkId, "ai.analyze_doc", 10, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  // Role gate: staff review surface only.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), { status: 404 });
  }
  if (!canAccess(user.role as Role, "staff")) {
    return NextResponse.json(err("FORBIDDEN", "Staff only"), { status: 403 });
  }

  // Graceful degradation when no API key (mirrors /api/ai/extract-cv).
  if (!env.anthropicKey()) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), { status: 400 });
  }

  let parsed: z.infer<typeof analyzeDocSchema>;
  try {
    parsed = analyzeDocSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid analyze payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  const r = await analyzeDocumentById(parsed.documentId);

  if (!r.ok) {
    // Audit failed runs too — staff-triggered vision calls are billable.
    await logAuditByClerkId(clerkId, {
      action: "ai.analyze_doc",
      resourceType: "document",
      resourceId: parsed.documentId,
      ipAddress: getIp(req),
      metadata: { ok: false, error: r.error, escalated: r.escalated ?? false },
    });
    switch (r.error) {
      case "not-found":
        return NextResponse.json(err("NOT_FOUND", "Document not found"), { status: 404 });
      case "unsupported-mime":
        return NextResponse.json(
          err("UNSUPPORTED_MEDIA_TYPE", "Only JPEG/PNG scans can be analyzed"),
          { status: 415 },
        );
      case "no-key":
        return NextResponse.json(
          err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
          { status: 503 },
        );
      default:
        // download-failed | api-error | unparseable
        return NextResponse.json(
          err("EXTERNAL_DEPENDENCY_FAILED", "Analysis failed"),
          { status: 502 },
        );
    }
  }

  await logAuditByClerkId(clerkId, {
    action: "ai.analyze_doc",
    resourceType: "document",
    resourceId: parsed.documentId,
    ipAddress: getIp(req),
    metadata: {
      ok: true,
      escalated: r.analysis.escalated,
      detectedType: r.analysis.detectedType,
      mismatch: r.analysis.mismatch,
      confidence: r.analysis.confidence,
    },
  });

  return NextResponse.json(ok({ analysis: r.analysis }));
}
