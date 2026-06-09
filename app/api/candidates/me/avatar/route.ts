// /api/candidates/me/avatar
//
//   POST — signed-in CANDIDATE → multipart image upload. Pushes the file to a
//          PRIVATE `avatars` bucket via the Supabase admin client and writes
//          the storage ref onto the caller's own Candidate.avatarUrl. This is
//          the ONLY route in the app that writes avatarUrl.
//   GET  — signed-in CANDIDATE → issues a short-lived signed URL for the
//          caller's own avatar (private bucket; no public URLs).
//
// Mirrors app/api/documents/route.ts: same CSRF / auth / rate-limit / size /
// MIME enforcement. The candidate id is always resolved from the session —
// never trusted from the client.

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, createSignedUrl } from "@/lib/supabase";
import { logAuditByClerkId } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, CsrfError } from "@/lib/csrf";
import { sanitizeFilename, encodeStorageRef, parseStorageRef } from "@/lib/documents";
import { err, ok } from "@/types/api";

// Private bucket for candidate profile photos. Reads are served only via
// short-lived signed URLs (see GET below).
const AVATAR_BUCKET = "avatars";

// Profile photos: 5 MB cap, common web image types only.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const SIGNED_URL_TTL_SECONDS = 900; // 15 min

function getIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || undefined;
  return req.headers.get("x-real-ip") ?? undefined;
}

async function resolveOwnCandidate(
  clerkId: string,
): Promise<
  | { ok: true; candidateId: string; userId: string; avatarUrl: string | null }
  | { ok: false; res: NextResponse }
> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      candidate: { select: { id: true, avatarUrl: true } },
    },
  });
  if (!user) {
    return {
      ok: false,
      res: NextResponse.json(
        err("NOT_FOUND", "User profile not yet synced; retry shortly"),
        { status: 404 },
      ),
    };
  }
  if (user.role !== "CANDIDATE" || !user.candidate) {
    return {
      ok: false,
      res: NextResponse.json(
        err("FORBIDDEN", "Only candidates can manage an avatar"),
        { status: 403 },
      ),
    };
  }
  return {
    ok: true,
    candidateId: user.candidate.id,
    userId: user.id,
    avatarUrl: user.candidate.avatarUrl,
  };
}

// ---------- GET (signed URL for the caller's own avatar) ----------

export async function GET(): Promise<NextResponse> {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  const allowed = await rateLimit(clerkId, "candidate.avatar.get", 60, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Slow down"), { status: 429 });
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  if (!resolved.avatarUrl) {
    return NextResponse.json(ok({ url: null, expiresAt: null }));
  }

  const ref = parseStorageRef(resolved.avatarUrl);
  if (!ref) {
    // Stored value isn't a recognised storage ref — treat as "no avatar".
    return NextResponse.json(ok({ url: null, expiresAt: null }));
  }

  const signed = await createSignedUrl(ref.bucket, ref.objectPath, SIGNED_URL_TTL_SECONDS);
  if ("error" in signed) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "Could not sign avatar URL"),
      { status: 502 },
    );
  }

  return NextResponse.json(
    ok({ url: signed.url, expiresAt: signed.expiresAt.toISOString() }),
  );
}

// ---------- POST (multipart image upload) ----------

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof CsrfError) {
      return NextResponse.json(err("FORBIDDEN", e.message), { status: 403 });
    }
    throw e;
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json(err("UNAUTHORIZED", "Sign-in required"), {
      status: 401,
    });
  }

  // 10 avatar uploads per minute per user.
  const allowed = await rateLimit(clerkId, "candidate.avatar.upload", 10, 60);
  if (!allowed) {
    return NextResponse.json(err("RATE_LIMITED", "Too many uploads, slow down"), {
      status: 429,
    });
  }

  const resolved = await resolveOwnCandidate(clerkId);
  if (!resolved.ok) return resolved.res;

  // Parse multipart form-data.
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      err("UNSUPPORTED_MEDIA_TYPE", "Expected multipart/form-data"),
      { status: 415 },
    );
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      err("VALIDATION_ERROR", "Could not parse multipart payload"),
      { status: 400 },
    );
  }

  // Validate file presence + MIME + size.
  const file = form.get("file");
  if (!(file instanceof Blob) || typeof (file as File).name !== "string") {
    return NextResponse.json(err("VALIDATION_ERROR", "Missing 'file' field"), {
      status: 400,
    });
  }
  const f = file as File;
  if (f.size <= 0) {
    return NextResponse.json(err("VALIDATION_ERROR", "Empty file"), {
      status: 400,
    });
  }
  if (f.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(err("PAYLOAD_TOO_LARGE", "Image exceeds 5 MB"), {
      status: 413,
    });
  }
  const mime = (f.type ?? "").toLowerCase();
  if (!ALLOWED_AVATAR_MIME.has(mime)) {
    return NextResponse.json(
      err(
        "UNSUPPORTED_MEDIA_TYPE",
        `Unsupported image type: ${mime || "unknown"}`,
      ),
      { status: 415 },
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", "Storage not configured"),
      { status: 500 },
    );
  }

  // Stable object path keyed by the candidate id so re-uploads overwrite the
  // previous photo (upsert: true) rather than orphaning storage objects.
  const safeName = sanitizeFilename(f.name);
  const objectPath = `candidate/${resolved.candidateId}/${safeName}`;
  const buffer = Buffer.from(await f.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(objectPath, buffer, { contentType: mime, upsert: true });
  if (uploadErr) {
    return NextResponse.json(
      err("EXTERNAL_DEPENDENCY_FAILED", `Upload failed: ${uploadErr.message}`),
      { status: 502 },
    );
  }

  // Persist the storage ref on the caller's own row. This is the only writer
  // of avatarUrl in the app.
  const fileUrl = encodeStorageRef(AVATAR_BUCKET, objectPath);
  await prisma.candidate.update({
    where: { id: resolved.candidateId },
    data: { avatarUrl: fileUrl },
  });

  await logAuditByClerkId(clerkId, {
    action: "candidate.avatar.upload",
    resourceType: "candidate",
    resourceId: resolved.candidateId,
    ipAddress: getIp(req) ?? undefined,
    metadata: { bucket: AVATAR_BUCKET, sizeBytes: f.size, mime },
  });

  // Return a fresh signed URL so the client can render the new photo at once.
  const signed = await createSignedUrl(
    AVATAR_BUCKET,
    objectPath,
    SIGNED_URL_TTL_SECONDS,
  );
  const url = "error" in signed ? null : signed.url;
  const expiresAt =
    "error" in signed ? null : signed.expiresAt.toISOString();

  return NextResponse.json(ok({ url, expiresAt }), { status: 201 });
}
