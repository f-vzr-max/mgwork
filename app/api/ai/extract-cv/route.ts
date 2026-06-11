// MG Work — CV extraction (M5).
//
// POST /api/ai/extract-cv  multipart/form-data, field name `file`
//   - Auth: CANDIDATE
//   - Rate limit: 5 / 300s per Clerk userId. Vision calls are expensive.
//   - Audit: ai.extract_cv
//
// Implementation:
//   - Accept image/jpeg, image/png, image/webp, image/gif, application/pdf.
//     The Anthropic SDK currently exposes images as `image` content blocks;
//     PDF support is mediated by the SDK helper for `document` blocks. To keep
//     this route narrow we only call `extractWithEscalation` for image MIME types
//     and short-circuit PDF with a 415 until the doc-block helper lands. (See
//     decision below — simplest correct behavior for the skeleton.)
//   - Convert the file body to base64 in memory. Cap at 10 MB so the lambda
//     doesn't OOM.
//   - Run any caller-supplied free text (rare for this endpoint, but possible
//     via an optional `instructions` form field) through `assertSafeForLLM`
//     before forwarding to Claude.
//   - Return a structured JSON envelope `CvExtractResult`. Claude is asked to
//     emit a single JSON block; we extract it best-effort and fall back to an
//     empty shape rather than 500 when the model deviates.
//
// Decisions:
//   - We never persist the uploaded file from this endpoint. The Document
//     wallet (M3) handles file storage. This route is for inline extraction
//     during candidate onboarding before the user commits anything.
//   - When ANTHROPIC_API_KEY is missing we return 503 with code
//     EXTERNAL_DEPENDENCY_FAILED so the UI can show a graceful "AI offline"
//     state instead of an opaque error.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { logAuditByClerkId } from "@/lib/audit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { extractWithEscalation } from "@/lib/claude";
import { assertSafeForLLM, AIDefenceError } from "@/lib/aidefence";
import { env } from "@/lib/config";
import { err, ok, type CvExtractResult } from "@/types/api";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

const SYSTEM_PROMPT = `You are an expert CV parser for AsanaoConnect, a Madagascar→Mauritius staffing platform. Extract structured profile data from the supplied document image.

Return ONLY a JSON object inside a single \`<extracted>\` ... \`</extracted>\` block. No prose outside the block. Schema:

{
  "firstName": string | null,
  "lastName": string | null,
  "skills": string[],          // up to 20, deduped, lowercase tokens
  "sectors": string[],         // up to 5, lowercase
  "languages": [{ "code": "FR" | "EN" | "MG", "selfLevel": 0..100 }],
  "experience": [{ "title": string, "company": string, "years": number }],
  "education": [{ "degree": string, "institution": string, "year": number | null }]
}

Be conservative: if a field is not clearly present, omit the entry from the array or set to null. Never invent data. Reply only with the JSON block.`;

// Escalation gate: true when the response carries a parseable JSON object
// inside an <extracted> block. Anything else retries once on the smart tier.
function hasExtractedBlock(text: string): boolean {
  const m = text.match(/<extracted>([\s\S]*?)<\/extracted>/i);
  if (!m) return false;
  try {
    const obj = JSON.parse(m[1]);
    return obj != null && typeof obj === "object";
  } catch {
    return false;
  }
}

function parseExtracted(text: string): CvExtractResult {
  const empty: CvExtractResult = {
    skills: [],
    sectors: [],
    languages: [],
    experience: [],
    education: [],
  };
  const m = text.match(/<extracted>([\s\S]*?)<\/extracted>/i);
  const raw = m ? m[1] : text;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return empty;
    const o = obj as Record<string, unknown>;
    return {
      firstName: typeof o.firstName === "string" ? o.firstName : undefined,
      lastName: typeof o.lastName === "string" ? o.lastName : undefined,
      skills: Array.isArray(o.skills)
        ? o.skills.filter((s): s is string => typeof s === "string").slice(0, 20)
        : [],
      sectors: Array.isArray(o.sectors)
        ? o.sectors.filter((s): s is string => typeof s === "string").slice(0, 5)
        : [],
      languages: Array.isArray(o.languages)
        ? (o.languages as unknown[])
            .map((l) => {
              if (!l || typeof l !== "object") return null;
              const it = l as Record<string, unknown>;
              const code = typeof it.code === "string" ? it.code.toUpperCase() : "";
              if (code !== "FR" && code !== "EN" && code !== "MG") return null;
              const selfLevel =
                typeof it.selfLevel === "number" ? Math.min(100, Math.max(0, Math.round(it.selfLevel))) : 0;
              return { code: code as "FR" | "EN" | "MG", selfLevel };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
        : [],
      experience: Array.isArray(o.experience)
        ? (o.experience as unknown[])
            .map((e) => {
              if (!e || typeof e !== "object") return null;
              const it = e as Record<string, unknown>;
              return {
                title: typeof it.title === "string" ? it.title : "",
                company: typeof it.company === "string" ? it.company : "",
                years: typeof it.years === "number" ? Math.max(0, Math.round(it.years)) : 0,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
        : [],
      education: Array.isArray(o.education)
        ? (o.education as unknown[])
            .map((e) => {
              if (!e || typeof e !== "object") return null;
              const it = e as Record<string, unknown>;
              return {
                degree: typeof it.degree === "string" ? it.degree : "",
                institution: typeof it.institution === "string" ? it.institution : "",
                year: typeof it.year === "number" ? Math.round(it.year) : undefined,
              };
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
        : [],
    };
  } catch {
    return empty;
  }
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

  const allowed = await rateLimit(clerkId, "ai.extract_cv", 5, 300);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  // Role check.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json(err("NOT_FOUND", "User profile not yet synced"), { status: 404 });
  }
  if (user.role !== "CANDIDATE") {
    return NextResponse.json(err("FORBIDDEN", "Only candidates can extract CV data"), { status: 403 });
  }

  // Graceful degradation when no API key.
  if (!env.anthropicKey()) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
      { status: 503 },
    );
  }

  // Parse multipart.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(err("VALIDATION_ERROR", "Expected multipart/form-data"), { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(err("VALIDATION_ERROR", "Missing `file` field"), { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json(err("VALIDATION_ERROR", "Empty file"), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(err("PAYLOAD_TOO_LARGE", "File exceeds 10 MB cap"), { status: 413 });
  }
  const mimeType = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      err("UNSUPPORTED_MEDIA_TYPE", "Upload an image (JPEG/PNG/WebP/GIF). PDF coming soon."),
      { status: 415 },
    );
  }

  // Optional caller instructions — must pass injection scan.
  const instructions = form.get("instructions");
  let userInstructions = "";
  if (typeof instructions === "string" && instructions.trim().length > 0) {
    try {
      assertSafeForLLM(instructions);
      userInstructions = instructions.trim();
    } catch (e) {
      if (e instanceof AIDefenceError) {
        return NextResponse.json(
          err("VALIDATION_ERROR", `Unsafe instructions: ${e.reasons.join(",")}`),
          { status: 400 },
        );
      }
      throw e;
    }
  }

  // Convert to base64 in memory.
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  const prompt = userInstructions
    ? `${SYSTEM_PROMPT}\n\nAdditional caller instructions:\n${userInstructions}`
    : SYSTEM_PROMPT;

  const r = await extractWithEscalation({
    base64,
    mimeType,
    prompt,
    maxTokens: 2048,
    validate: (res) => hasExtractedBlock(res.text),
  });

  if ("error" in r) {
    if (r.error === "no-key") {
      return NextResponse.json(
        err("EXTERNAL_DEPENDENCY_FAILED", "ai-unavailable"),
        { status: 503 },
      );
    }
    // api-error
    await logAuditByClerkId(clerkId, {
      action: "ai.extract_cv",
      resourceType: "candidate",
      resourceId: user.id,
      ipAddress: getIp(req),
      metadata: { ok: false, escalated: r.escalated, error: r.message.slice(0, 200) },
    });
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "Upstream AI failure"),
      { status: 502 },
    );
  }

  const result = parseExtracted(r.text);

  await logAuditByClerkId(clerkId, {
    action: "ai.extract_cv",
    resourceType: "candidate",
    resourceId: user.id,
    ipAddress: getIp(req),
    metadata: {
      ok: true,
      escalated: r.escalated,
      mimeType,
      bytes: file.size,
      skillCount: result.skills.length,
      sectorCount: result.sectors.length,
      langCount: result.languages.length,
    },
  });

  return NextResponse.json(ok(result));
}
