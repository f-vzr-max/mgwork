// MG Work — Language self-assessment scoring (M5).
//
// POST /api/ai/lang-test  body: { lang: 'FR'|'EN', answers: [{ q, a }] }
//   - Auth: CANDIDATE
//   - Rate limit: 5 / 300s per Clerk userId. Lang scoring is fast but we cap
//     anyway so a misbehaving client can't drain credits.
//   - Audit: ai.lang_test
//
// Implementation:
//   - Each answer.q and answer.a is run through `assertSafeForLLM` first.
//     The Q is operator-supplied in practice but we still scan because we
//     accept it from the client (no DB-side question store yet).
//   - Calls Claude (`MODELS.fast` — Haiku) to grade FR or EN proficiency
//     0..100. We require the model to return a single integer in
//     `<score>NN</score>` tags so parsing is trivial. If parsing fails we
//     fall back to 0 and audit `ok: false`.
//   - Persists the result on Candidate.langScoreFR or .langScoreEN.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ZodError } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { chat } from "@/lib/claude";
import { assertSafeForLLM, AIDefenceError } from "@/lib/aidefence";
import { env } from "@/lib/config";
import { aiLangTestSchema } from "@/lib/validation/ai";
import { err, ok, type LangTestResult } from "@/types/api";

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

function buildSystemPrompt(lang: "FR" | "EN"): string {
  const target = lang === "FR" ? "French (français)" : "English";
  return `You are an examiner grading a candidate's ${target} proficiency for staffing in Mauritius.
Read each question and the candidate's free-form answer. Score the candidate's overall proficiency in ${target} on a CEFR-aligned 0–100 scale where:
- 0–20  ≈ A1 (basic words / no real sentences)
- 21–40 ≈ A2 (simple short sentences, errors are frequent)
- 41–60 ≈ B1 (everyday topics, clear errors but understandable)
- 61–80 ≈ B2 (independent, occasional errors, full topics)
- 81–95 ≈ C1 (effective, fluent, rare errors)
- 96–100 ≈ C2 (mastery, near-native)

Respond ONLY with two tags, in this exact format:
<score>NN</score>
<feedback>One short sentence (max 30 words), in ${target}, summarizing the candidate's level and main weakness.</feedback>

Do not include any prose outside the tags. Do not invent answers; score only what is written.`;
}

function buildUserPrompt(answers: { q: string; a: string }[]): string {
  return answers
    .map((qa, i) => `Q${i + 1}: ${qa.q}\nA${i + 1}: ${qa.a}`)
    .join("\n\n");
}

function parseScore(text: string): { score: number; feedback?: string } {
  const m = text.match(/<score>\s*(\d{1,3})\s*<\/score>/i);
  const f = text.match(/<feedback>([\s\S]*?)<\/feedback>/i);
  const score = m ? Math.min(100, Math.max(0, Number.parseInt(m[1], 10))) : 0;
  const feedback = f ? f[1].trim().slice(0, 400) : undefined;
  return { score, feedback };
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

  const allowed = await rateLimit(clerkId, "ai.lang_test", 5, 300);
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
    parsed = aiLangTestSchema.parse(body);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of e.issues) {
        const key = issue.path.join(".") || "_";
        if (!fieldErrors[key]) fieldErrors[key] = [];
        fieldErrors[key].push(issue.message);
      }
      return NextResponse.json(
        err("VALIDATION_ERROR", "Invalid lang-test payload", { fieldErrors }),
        { status: 400 },
      );
    }
    throw e;
  }

  // Defense scan every Q/A.
  try {
    for (const qa of parsed.answers) {
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
    return NextResponse.json(err("FORBIDDEN", "Only candidates can take the language test"), { status: 403 });
  }

  if (!env.anthropicKey()) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
      { status: 503 },
    );
  }

  const r = await chat({
    system: buildSystemPrompt(parsed.lang),
    messages: [{ role: "user", content: buildUserPrompt(parsed.answers) }],
    model: "fast",
    maxTokens: 256,
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
      action: "ai.lang_test",
      resourceType: "candidate",
      resourceId: user.candidate.id,
      ipAddress: getIp(req),
      metadata: { ok: false, error: r.message.slice(0, 200), lang: parsed.lang },
    });
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "Upstream AI failure"),
      { status: 502 },
    );
  }

  const { score, feedback } = parseScore(r.text);

  await prisma.candidate.update({
    where: { id: user.candidate.id },
    data: parsed.lang === "FR" ? { langScoreFR: score } : { langScoreEN: score },
  });

  await logAuditByClerkId(clerkId, {
    action: "ai.lang_test",
    resourceType: "candidate",
    resourceId: user.candidate.id,
    ipAddress: getIp(req),
    metadata: {
      ok: true,
      lang: parsed.lang,
      score,
      answerCount: parsed.answers.length,
    },
  });

  const result: LangTestResult = { lang: parsed.lang, score, feedback };
  return NextResponse.json(ok(result));
}
