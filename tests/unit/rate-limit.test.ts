import { _resetRateLimits, rateLimit, consume } from "@/lib/rate-limit";
import { env } from "@/lib/config";

jest.mock("@/lib/config", () => ({
  env: {
    upstashUrl: jest.fn(() => undefined),
    upstashToken: jest.fn(() => undefined),
  },
}));

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

describe("rateLimit (Upstash path)", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    (env.upstashUrl as jest.Mock).mockReturnValue("https://upstash.test");
    (env.upstashToken as jest.Mock).mockReturnValue("tok");
  });

  afterEach(() => {
    (env.upstashUrl as jest.Mock).mockReturnValue(undefined);
    (env.upstashToken as jest.Mock).mockReturnValue(undefined);
    global.fetch = realFetch;
  });

  function mockIncr(count: number) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: count }, { result: 1 }],
    }) as unknown as typeof fetch;
  }

  it("allows when the INCR count is within capacity", async () => {
    mockIncr(2);
    expect(await rateLimit("up1", "create", 3, 60)).toBe(true);
  });

  it("denies when the INCR count exceeds capacity", async () => {
    mockIncr(4);
    expect(await rateLimit("up2", "create", 3, 60)).toBe(false);
  });

  it("falls back to in-memory (allowed) when fetch throws/aborts", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("aborted")) as unknown as typeof fetch;
    expect(await rateLimit("up3", "create", 3, 60)).toBe(true);
  });
});
