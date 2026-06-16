// AI document detection (M5 follow-up) — advisory classification of uploaded
// documents via Claude vision.
//
//   - Classify the scan into a DocumentType, extract a visible expiry date,
//     and compare against the declared Document.type.
//   - Persist `{ detectedType, expiryDate, mismatch, confidence, analyzedAt }`
//     to Document.aiAnalysis (Json). Statuses are NEVER touched here — the
//     verdict is a read-only flag for the staff review surfaces.
//   - Model policy: Haiku ("fast") via escalation helpers only; Sonnet runs at
//     most once as the escalation retry. Never Opus.
//
// Callers:
//   - app/api/documents/route.ts  → best-effort background run on upload
//     (wrapped in `analyzeDocumentSafely`, scheduled via waitUntil).
//   - app/api/ai/analyze-doc      → staff-gated on-demand (re)run.
//
// PDF wired but inert (no-key no-op); do not enable in prod until Anthropic
// funded. Enablement is gated by ANTHROPIC_API_KEY presence — no feature flag.
// DOCX remains unsupported-mime (Anthropic has no equivalent document block).

import type { DocumentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseStorageRef } from "@/lib/documents";
import { extractWithEscalation, extractPdfWithEscalation, type ExtractSuccess } from "@/lib/claude";
import { DOCUMENT_TYPES } from "@/lib/validation/document";
import { isExpired, isExpiringWithin } from "@/lib/dates";

// Shape persisted to Document.aiAnalysis.
export type DocAiAnalysis = {
  detectedType: DocumentType;
  expiryDate: string | null; // "YYYY-MM-DD" when visible on the document
  mismatch: boolean;
  confidence: number; // 0..1
  analyzedAt: string; // ISO timestamp
  escalated: boolean; // smart-tier retry ran (audit parity)
};

export type DocAnalysisResult =
  | { ok: true; analysis: DocAiAnalysis }
  | {
      ok: false;
      error:
        | "not-found"
        | "unsupported-mime"
        | "download-failed"
        | "no-key"
        | "api-error"
        | "unparseable";
      message?: string;
      escalated?: boolean;
    };

// Only MIME types both allowed for document uploads (lib/documents.ts) and
// supported by lib/claude.ts content blocks (image or PDF document).
const ANALYZABLE_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

export function isAnalyzableMime(mime: string | null | undefined): boolean {
  return Boolean(mime) && ANALYZABLE_MIME.has(String(mime).toLowerCase());
}

const PROMPT = `You are a document classifier for AsanaoConnect, a Madagascar→Mauritius staffing platform. Look at the supplied document image and classify it.

Return ONLY a JSON object inside a single \`<analysis>\` ... \`</analysis>\` block. No prose outside the block. Schema:

{
  "detectedType": "PASSPORT" | "MEDICAL_AUTHORIZATION" | "WORK_PERMIT" | "VISA" | "INCORPORATION_CERTIFICATE" | "OTHER",
  "expiryDate": "YYYY-MM-DD" | null,   // expiry/validity end date if clearly visible, else null
  "confidence": 0..1                    // your confidence in detectedType
}

Rules:
- PASSPORT: passport identity/data page. VISA: visa sticker/stamp page. WORK_PERMIT: work/employment permit. MEDICAL_AUTHORIZATION: medical certificate or fitness-to-work authorization. INCORPORATION_CERTIFICATE: company registration/incorporation certificate.
- Use "OTHER" when the document fits none of the above or is unreadable.
- Be conservative: never invent an expiry date — null unless a date labelled as expiry/valid-until is legible.
- Reply only with the JSON block.`;

// Escalation gate: the fast tier passes only when the reply carries a
// parseable <analysis> JSON object with a valid detectedType.
export function hasAnalysisBlock(text: string): boolean {
  return parseAnalysisBlock(text) !== null;
}

type RawAnalysis = {
  detectedType: DocumentType;
  expiryDate: string | null;
  confidence: number;
};

// Parse the model reply. Returns null when the block is missing/garbled —
// callers treat that as "unparseable" (never persist garbage).
export function parseAnalysisBlock(text: string): RawAnalysis | null {
  const m = text.match(/<analysis>([\s\S]*?)<\/analysis>/i);
  const raw = m ? m[1] : text;
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const detected =
    typeof o.detectedType === "string" ? o.detectedType.toUpperCase() : "";
  if (!(DOCUMENT_TYPES as readonly string[]).includes(detected)) return null;
  return {
    detectedType: detected as DocumentType,
    expiryDate: normalizeExpiryDate(o.expiryDate),
    confidence:
      typeof o.confidence === "number"
        ? Math.min(1, Math.max(0, o.confidence))
        : 0,
  };
}

// Accept only a real "YYYY-MM-DD" calendar date; anything else → null.
export function normalizeExpiryDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(`${v.trim()}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === v.trim() ? v.trim() : null;
}

// Mismatch rule: flag only a confident, concrete disagreement. "OTHER" on
// either side is inconclusive, not a red flag — staff still see the detected
// type in the UI either way.
export function computeMismatch(
  declared: DocumentType,
  detected: DocumentType,
  confidence: number,
): boolean {
  if (declared === detected) return false;
  if (declared === "OTHER" || detected === "OTHER") return false;
  return confidence >= 0.5;
}

// Read a persisted Document.aiAnalysis Json back into a typed shape (UI-side
// guard — the column is untyped Json and could hold anything historically).
export function readDocAiAnalysis(v: unknown): DocAiAnalysis | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (
    typeof o.detectedType !== "string" ||
    !(DOCUMENT_TYPES as readonly string[]).includes(o.detectedType)
  ) {
    return null;
  }
  return {
    detectedType: o.detectedType as DocumentType,
    expiryDate: normalizeExpiryDate(o.expiryDate),
    mismatch: o.mismatch === true,
    confidence:
      typeof o.confidence === "number"
        ? Math.min(1, Math.max(0, o.confidence))
        : 0,
    analyzedAt: typeof o.analyzedAt === "string" ? o.analyzedAt : "",
    escalated: o.escalated === true,
  };
}

// Advisory flag for the review surfaces: set when the AI verdict disagrees
// with the declared type, or the AI-extracted expiry is past / ≤30 days out.
export type DocAiFlag = {
  mismatch: boolean;
  expiry: "expired" | "soon" | null;
};

export function docAiFlag(
  analysis: DocAiAnalysis | null,
  now: Date = new Date(),
): DocAiFlag | null {
  if (!analysis) return null;
  let expiry: DocAiFlag["expiry"] = null;
  if (analysis.expiryDate) {
    if (isExpired(analysis.expiryDate, now)) expiry = "expired";
    else if (isExpiringWithin(analysis.expiryDate, 30, now)) expiry = "soon";
  }
  if (!analysis.mismatch && !expiry) return null;
  return { mismatch: analysis.mismatch, expiry };
}

// ---------------------------------------------------------------------------
// Analysis runners (impure — Claude + Prisma + Supabase)
// ---------------------------------------------------------------------------

// Run the vision call on an in-memory file and persist the verdict.
export async function analyzeDocumentImage(input: {
  documentId: string;
  declaredType: DocumentType;
  base64: string;
  mimeType: string;
}): Promise<DocAnalysisResult> {
  if (!isAnalyzableMime(input.mimeType)) {
    return { ok: false, error: "unsupported-mime" };
  }

  const mimeType = input.mimeType.toLowerCase();
  const validate = (res: ExtractSuccess) => hasAnalysisBlock(res.text);
  const r =
    mimeType === "application/pdf"
      ? await extractPdfWithEscalation({ base64: input.base64, prompt: PROMPT, maxTokens: 512, validate })
      : await extractWithEscalation({ base64: input.base64, mimeType, prompt: PROMPT, maxTokens: 512, validate });

  if ("error" in r) {
    if (r.error === "no-key") return { ok: false, error: "no-key" };
    return {
      ok: false,
      error: "api-error",
      message: r.message,
      escalated: r.escalated,
    };
  }

  const parsed = parseAnalysisBlock(r.text);
  if (!parsed) {
    return { ok: false, error: "unparseable", escalated: r.escalated };
  }

  const analysis: DocAiAnalysis = {
    detectedType: parsed.detectedType,
    expiryDate: parsed.expiryDate,
    mismatch: computeMismatch(
      input.declaredType,
      parsed.detectedType,
      parsed.confidence,
    ),
    confidence: parsed.confidence,
    analyzedAt: new Date().toISOString(),
    escalated: r.escalated,
  };

  await prisma.document.update({
    where: { id: input.documentId },
    data: { aiAnalysis: analysis },
  });

  return { ok: true, analysis };
}

// Load a Document, download its file from Supabase storage, and analyze it.
// Used by the on-demand staff route where the bytes are no longer in memory.
export async function analyzeDocumentById(
  documentId: string,
): Promise<DocAnalysisResult> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, type: true, fileUrl: true },
  });
  if (!doc) return { ok: false, error: "not-found" };

  const ref = parseStorageRef(doc.fileUrl);
  if (!ref) return { ok: false, error: "download-failed", message: "bad storage ref" };

  // Cheap extension gate before downloading — object paths keep the original
  // (sanitized) filename, so PDFs/DOCX are skippable without a fetch.
  const extMime = mimeFromPath(ref.objectPath);
  if (extMime && !isAnalyzableMime(extMime)) {
    return { ok: false, error: "unsupported-mime" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { ok: false, error: "download-failed", message: "storage not configured" };
  }
  const { data, error } = await supabase.storage
    .from(ref.bucket)
    .download(ref.objectPath);
  if (error || !data) {
    return {
      ok: false,
      error: "download-failed",
      message: error?.message ?? "empty download",
    };
  }

  const mime = (data.type || extMime || "").toLowerCase();
  const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
  return analyzeDocumentImage({
    documentId: doc.id,
    declaredType: doc.type,
    base64,
    mimeType: mime,
  });
}

function mimeFromPath(p: string): string | null {
  const ext = p.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return null;
  }
}

// Best-effort wrapper for the upload hot path (scheduled via waitUntil).
// Never throws — an analysis failure must not surface on the upload response.
export async function analyzeDocumentSafely(input: {
  documentId: string;
  declaredType: DocumentType;
  base64: string;
  mimeType: string;
}): Promise<void> {
  try {
    const r = await analyzeDocumentImage(input);
    if (!r.ok && r.error !== "unsupported-mime" && r.error !== "no-key") {
      console.error(
        `doc-analysis: background analysis failed for ${input.documentId}: ${r.error}${r.message ? ` (${r.message})` : ""}`,
      );
    }
  } catch (e) {
    console.error(
      `doc-analysis: background analysis threw for ${input.documentId}`,
      e,
    );
  }
}
