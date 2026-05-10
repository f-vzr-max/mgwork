// MG Work — Interview simulator (M5).
//
// POST /api/ai/interview-sim  body discriminated by `phase`:
//   { phase: 'questions', offerId }                              → 5 role-specific Qs
//   { phase: 'evaluate',  offerId, qa: [{ q, a }] }              → evaluation
//
//   - Auth: CANDIDATE (any candidate can simulate against any ACTIVE offer
//     they want to apply to; we don't restrict to applied-to offers because
//     the whole point is to *prepare* before applying).
//   - Rate limit: 5 / 300s per Clerk userId per phase.
//   - Audit: ai.interview_sim
//
// Implementation:
//   - questions phase: Claude (smart) returns 5 questions in numbered tags;
//     we parse and return them with stable cuid-style ids generated server-
//     side (random). The client pairs each with the candidate's answer and
//     re-POSTs phase=evaluate.
//   - evaluate phase: each q & a are scanned via `assertSafeForLLM`. Claude
//     produces a global 0–100 score and a short overall feedback line; we
//     do NOT need per-question scoring for the skeleton (would require more
//     prompt tokens) — the type accepts both shapes per types/api.ts.
//   - DB-write side-effect: NONE. We don't persist the questions or the
//     evaluation; that's owned by the M7 Application/Interview flow.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/claude";
import { assertSafeForLLM, AIDefenceError } from "@/lib/aidefence";
import { env } from "@/lib/config";
import { aiInterviewSimSchema } from "@/lib/validation/ai";
import {
  err,
  ok,
  type InterviewSimQuestionsResponse,
  type InterviewSimEvaluationResponse,
} from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

const QUESTIONS_SYSTEM = `You are MG Work's interview coach for a Madagascar→Mauritius placement. Generate 5 concise, role-specific interview questions for the supplied job. Mix behavioural, technical, and motivational questions appropriate to the role's sector and required skills.

Respond ONLY with 5 lines, each line in this exact format:
<q>question text here</q>

No numbering, no preamble, no postamble. Each question must be ≤ 35 words. Phrase questions in the offer's primary language (default French if multiple).`;

const EVALUATE_SYSTEM = `You are MG Work's interview evaluator. Score the candidate's overall interview performance against the supplied job context, on a 0–100 scale.

Respond ONLY with two tags, in this exact format:
<score>NN</score>
<feedback>One paragraph (max 80 words) summarizing strengths and the single biggest gap, in the same language as the candidate's answers.</feedback>

Do not invent answers, do not score answers the candidate didn't give.`;

function parseQuestions(text: string): { id: string; text: string }[] {
  const re = /<q>([\s\S]*?)<\/q>/gi;
  const out: { id: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1].trim();
    if (t.length > 0) out.push({ id: randomUUID(), text: t.slice(0, 500) });
    if (out.length >= 5) break;
  }
  return out;
}

function parseEvaluation(text: string): { score: number; feedback?: string } {
  const m = text.match(/<score>\s*(\d{1,3})\s*<\/score>/i);
  const f = text.match(/<feedback>([\s\S]*?)<\/feedback>/i);
  const score = m ? Math.min(100, Math.max(0, Number.parseInt(m[1], 10))) : 0;
  const feedback = f ? f[1].trim().slice(0, 800) : undefined;
  return { score, feedback };
}

function buildOfferContext(o: {
  title: string;
  description: string;
  sector: string;
  requirements: string[];
  langRequired: string[];
}): string {
  return [
    `Title: ${o.title}`,
    `Sector: ${o.sector}`,
    `Languages required: ${o.langRequired.join(", ") || "none specified"}`,
    `Key requirements: ${o.requirements.slice(0, 12).join(", ") || "none specified"}`,
    `Description: ${o.description.slice(0, 1500)}`,
  ].join("\n");
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

  const allowed = await rateLimit(clerkId, "ai.interview_sim", 5, 300);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Body must be JSON"), { status: 400 });
  }

  let parsed;
  try {
    parsed = aiInterviewSimSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid interview-sim payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      candidate: { select: { id: true } },
    },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), { status: 404 });
  }
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return NextResponse.json(err("FORBIDDEN", "Only candidates can simulate interviews"), { status: 403 });
  }

  const offer = await prisma.jobOffer.findUnique({
    where: { id: parsed.offerId },
    select: {
      id: true,
      title: true,
      description: true,
      sector: true,
      requirements: true,
      langRequired: true,
    },
  });
  if (!offer) {
    return NextResponse.json(err("NOT_FOUND", "Offer not found"), { status: 404 });
  }

  if (!env.anthropicKey()) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
      { status: 503 },
    );
  }

  if (parsed.phase === "questions") {
    const r = await chat({
      system: QUESTIONS_SYSTEM,
      messages: [{ role: "user", content: buildOfferContext(offer) }],
      model: "smart",
      maxTokens: 800,
      temperature: 0.4,
    });

    if ("error" in r) {
      if (r.error === "no-key") {
        return NextResponse.json(
          err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
          { status: 503 },
        );
      }
      await logAuditByClerkId(clerkId, {
        action: "ai.interview_sim",
        resourceType: "job_offer",
        resourceId: offer.id,
        ipAddress: getIp(req),
        metadata: { phase: "questions", ok: false, error: r.message.slice(0, 200) },
      });
      return NextResponse.json(
        err("EXTERNAL_DEPENDENCY_FAILED", "Upstream AI failure"),
        { status: 502 },
      );
    }

    const questions = parseQuestions(r.text);

    await logAuditByClerkId(clerkId, {
      action: "ai.interview_sim",
      resourceType: "job_offer",
      resourceId: offer.id,
      ipAddress: getIp(req),
      metadata: { phase: "questions", ok: true, count: questions.length },
    });

    const payload: InterviewSimQuestionsResponse = { questions };
    return NextResponse.json(ok(payload));
  }

  // phase === 'evaluate'
  try {
    for (const qa of parsed.qa) {
      assertSafeForLLM(qa.q);
      assertSafeForLLM(qa.a);
    }
  } catch (e) {
    if (e instanceof AIDefenceError) {
      return NextResponse.json(
        err("VALIDATION_ERROR", `Unsafe input: ${e.reasons.join(",")}`),
        { status: 400 },
      );
    }
    throw e;
  }

  const userMsg = [
    "Job context:",
    buildOfferContext(offer),
    "",
    "Candidate transcript:",
    parsed.qa
      .map((qa, i) => `Q${i + 1}: ${qa.q}\nA${i + 1}: ${qa.a}`)
      .join("\n\n"),
  ].join("\n");

  const r = await chat({
    system: EVALUATE_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
    model: "smart",
    maxTokens: 600,
    temperature: 0,
  });

  if ("error" in r) {
    if (r.error === "no-key") {
      return NextResponse.json(
        err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
        { status: 503 },
      );
    }
    await logAuditByClerkId(clerkId, {
      action: "ai.interview_sim",
      resourceType: "job_offer",
      resourceId: offer.id,
      ipAddress: getIp(req),
      metadata: { phase: "evaluate", ok: false, error: r.message.slice(0, 200) },
    });
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "Upstream AI failure"),
      { status: 502 },
    );
  }

  const { score, feedback } = parseEvaluation(r.text);

  await logAuditByClerkId(clerkId, {
    action: "ai.interview_sim",
    resourceType: "job_offer",
    resourceId: offer.id,
    ipAddress: getIp(req),
    metadata: { phase: "evaluate", ok: true, score, qaCount: parsed.qa.length },
  });

  // Per types/api.ts InterviewSimEvaluationResponse needs `total` and
  // `perQuestion`. We have an overall score + feedback; emit a single
  // entry per question that reuses the global score/feedback so the shape
  // is satisfied while we keep tokens bounded.
  const payload: InterviewSimEvaluationResponse = {
    total: score,
    perQuestion: parsed.qa.map((qa, i) => ({
      id: `q${i + 1}`,
      score,
      feedback: feedback ?? "",
    })),
  };
  return NextResponse.json(ok(payload));
}
