// Pure in-memory token bucket per `${userId}:${action}` key. PROCESS-LOCAL —
// in serverless deployments each lambda gets its own bucket, so this is a
// best-effort guard rather than a strict global limit. When the platform moves
// off Vercel single-instance / a real anti-abuse layer is needed, swap the
// implementation for Upstash Redis (signature is intentionally async).

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

// Returns `false` when the request is over the limit. Backwards-compatible
// signature with the spec — internals expose `consume()` for richer info.
export async function rateLimit(
  key: string,
  action: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const result = consume(`${key}:${action}`, max, windowSeconds * 1000);
  return result.allowed;
}

export function consume(bucketKey: string, capacity: number, windowMs: number): RateLimitResult {
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
