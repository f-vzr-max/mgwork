// Rate limiting with two backends. Default is a process-local in-memory token
// bucket per `${userId}:${action}` — best-effort only, since each serverless
// lambda gets its own buckets. When Upstash Redis REST is configured, requests
// route through a fixed-window INCR counter for real cross-instance limiting;
// any Upstash failure falls back to the in-memory path for that request.
//
// The Upstash path is fixed-window (INCR+EXPIRE), NOT the in-memory token
// bucket — it can permit up to ~2x burst at window boundaries. Acceptable for
// cost/abuse limiting; behavior is not byte-identical to consumeLocal.

import { env } from "@/lib/config";

type Bucket = {
  tokens: number;
  refilledAt: number; // epoch ms when tokens were last refilled
  capacity: number;
  windowMs: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

let warned = false;

// Returns `false` when the request is over the limit. Decides the backend PER
// CALL (cheap process.env read) so the Upstash branch stays unit-testable
// without module reloads.
export async function rateLimit(
  key: string,
  action: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucketKey = `${key}:${action}`;
  const windowMs = windowSeconds * 1000;
  const useUpstash = !!(env.upstashUrl() && env.upstashToken());

  if (!useUpstash) {
    if (!warned && process.env.VERCEL_ENV === "production") {
      warned = true;
      console.error(
        "[rate-limit] PRODUCTION running without Upstash — per-lambda in-memory limiting only (not global)",
      );
    }
    return consumeLocal(bucketKey, max, windowMs).allowed;
  }

  return (await consumeUpstash(bucketKey, max, windowMs)).allowed;
}

async function consumeUpstash(
  bucketKey: string,
  capacity: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const baseUrl = env.upstashUrl();
  const token = env.upstashToken();
  if (!baseUrl || !token) return consumeLocal(bucketKey, capacity, windowMs);

  const windowKey = `${bucketKey}:${Math.floor(Date.now() / windowMs)}`;
  const ttl = Math.ceil(windowMs / 1000);
  try {
    const res = await fetch(`${baseUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", windowKey],
        ["EXPIRE", windowKey, ttl],
      ]),
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return consumeLocal(bucketKey, capacity, windowMs);
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    if (count > capacity) {
      return { allowed: false, remaining: 0, retryAfterMs: windowMs };
    }
    return { allowed: true, remaining: Math.max(0, capacity - count), retryAfterMs: 0 };
  } catch {
    return consumeLocal(bucketKey, capacity, windowMs);
  }
}

export function consume(bucketKey: string, capacity: number, windowMs: number): RateLimitResult {
  return consumeLocal(bucketKey, capacity, windowMs);
}

function consumeLocal(bucketKey: string, capacity: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(bucketKey);
  if (!b || b.capacity !== capacity || b.windowMs !== windowMs) {
    b = { tokens: capacity, refilledAt: now, capacity, windowMs };
    buckets.set(bucketKey, b);
  }
  // Refill linearly proportional to elapsed time.
  const elapsed = now - b.refilledAt;
  if (elapsed > 0) {
    const refill = (elapsed / windowMs) * capacity;
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.refilledAt = now;
  }
  if (b.tokens < 1) {
    const tokensNeeded = 1 - b.tokens;
    const retryAfterMs = Math.ceil((tokensNeeded / capacity) * windowMs);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
  b.tokens -= 1;
  return {
    allowed: true,
    remaining: Math.floor(b.tokens),
    retryAfterMs: 0,
  };
}

// Test-only: drain all buckets.
export function _resetRateLimits(): void {
  buckets.clear();
}
