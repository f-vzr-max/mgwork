import { _resetRateLimits, rateLimit, consume } from "@/lib/rate-limit";

beforeEach(() => {
  _resetRateLimits();
});

describe("rateLimit", () => {
  it("allows up to `max` requests in the window", async () => {
    const max = 3;
    const window = 60;
    expect(await rateLimit("user1", "create", max, window)).toBe(true);
    expect(await rateLimit("user1", "create", max, window)).toBe(true);
    expect(await rateLimit("user1", "create", max, window)).toBe(true);
  });

  it("blocks additional requests beyond `max`", async () => {
    const max = 2;
    const window = 60;
    expect(await rateLimit("user2", "create", max, window)).toBe(true);
    expect(await rateLimit("user2", "create", max, window)).toBe(true);
    // Third request — over the limit (refill in 60s would be tiny).
    expect(await rateLimit("user2", "create", max, window)).toBe(false);
  });

  it("isolates different users", async () => {
    const max = 1;
    const window = 60;
    expect(await rateLimit("alice", "x", max, window)).toBe(true);
    expect(await rateLimit("alice", "x", max, window)).toBe(false);
    // Bob has his own bucket.
    expect(await rateLimit("bob", "x", max, window)).toBe(true);
  });

  it("isolates different actions for the same user", async () => {
    const max = 1;
    const window = 60;
    expect(await rateLimit("u3", "create", max, window)).toBe(true);
    expect(await rateLimit("u3", "create", max, window)).toBe(false);
    expect(await rateLimit("u3", "delete", max, window)).toBe(true);
  });

  it("refills tokens after the window elapses (fake timers)", async () => {
    jest.useFakeTimers();
    try {
      const max = 2;
      const window = 10; // 10 seconds
      // burn the bucket
      expect(await rateLimit("u4", "create", max, window)).toBe(true);
      expect(await rateLimit("u4", "create", max, window)).toBe(true);
      expect(await rateLimit("u4", "create", max, window)).toBe(false);

      // Advance past the window — bucket should be fully refilled.
      jest.advanceTimersByTime(window * 1000 + 100);
      expect(await rateLimit("u4", "create", max, window)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("consume", () => {
  it("returns retryAfterMs when blocked", () => {
    const r1 = consume("k", 1, 1000);
    expect(r1.allowed).toBe(true);
    const r2 = consume("k", 1, 1000);
    expect(r2.allowed).toBe(false);
    expect(r2.retryAfterMs).toBeGreaterThan(0);
  });
});
