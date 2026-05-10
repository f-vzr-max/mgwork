import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./config";

// Server-side admin client. Uses the service-role key — NEVER import from any
// file that runs in the browser. Throws on accidental browser use.
let cachedAdmin: SupabaseClient | null | undefined;
let cachedBrowser: SupabaseClient | null | undefined;

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("supabase admin client must not be used in the browser");
  }
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdmin !== undefined) return cachedAdmin;
  assertServer();
  const url = env.supabaseUrl();
  const key = env.supabaseServiceKey();
  if (!url || !key) {
    cachedAdmin = null;
    return cachedAdmin;
  }
  cachedAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}

// Browser anon client. Safe to use in client components. Reads from public env
// vars only.
export function getSupabaseBrowser(): SupabaseClient | null {
  if (cachedBrowser !== undefined) return cachedBrowser;
  const url = env.supabaseUrl();
  const key = env.supabaseAnonKey();
  if (!url || !key) {
    cachedBrowser = null;
    return cachedBrowser;
  }
  cachedBrowser = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return cachedBrowser;
}

// Reset cached clients. Test-only.
export function _resetSupabaseClients(): void {
  cachedAdmin = undefined;
  cachedBrowser = undefined;
}

export type SignedUrlResult =
  | { error: "no-config" }
  | { error: "storage-error"; message: string }
  | { url: string; expiresAt: Date };

// Issue a time-limited signed URL for a private storage object. Default 15 min.
// Server-only — uses the admin client.
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 900,
): Promise<SignedUrlResult> {
  const admin = getSupabaseAdmin();
  if (!admin) return { error: "no-config" };
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return { error: "storage-error", message: error?.message ?? "missing signed URL" };
  }
  return {
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  };
}

// Convenience: build a storage path scoped under {role}/{userId}/{type}/{filename}
// to keep file paths predictable (and align with future RLS policies).
export function buildStoragePath(parts: {
  role: string;
  userId: string;
  type: string;
  filename: string;
}): string {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9_.\-]/g, "_");
  return `${safe(parts.role)}/${safe(parts.userId)}/${safe(parts.type)}/${safe(parts.filename)}`;
}
