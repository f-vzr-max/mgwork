import { daysUntil, isExpired, isExpiringWithin } from "@/lib/dates";

// All fixtures use UTC to avoid TZ-dependent flakes.
const NOW = new Date(Date.UTC(2026, 4, 5, 12, 0, 0)); // 2026-05-05T12:00:00Z

const today = new Date(Date.UTC(2026, 4, 5, 8, 0, 0));
const tomorrow = new Date(Date.UTC(2026, 4, 6, 12, 0, 0));
const inTenDays = new Date(Date.UTC(2026, 4, 15, 12, 0, 0));
const inSixtyDays = new Date(Date.UTC(2026, 6, 4, 12, 0, 0));
const yesterday = new Date(Date.UTC(2026, 4, 4, 12, 0, 0));
const lastYear = new Date(Date.UTC(2025, 4, 5, 12, 0, 0));

describe("daysUntil", () => {
  it("returns 0 for the same calendar day", () => {
    expect(daysUntil(today, NOW)).toBe(0);
  });

  it("returns positive whole days for future dates", () => {
    expect(daysUntil(tomorrow, NOW)).toBe(1);
    expect(daysUntil(inTenDays, NOW)).toBe(10);
  });

  it("returns negative for past dates", () => {
    expect(daysUntil(yesterday, NOW)).toBe(-1);
    expect(daysUntil(lastYear, NOW)).toBe(-365);
  });

  it("accepts ISO strings", () => {
    expect(daysUntil("2026-05-15T00:00:00Z", NOW)).toBe(10);
  });

  it("throws on invalid input", () => {
    expect(() => daysUntil("not-a-date", NOW)).toThrow(/invalid/i);
  });
});

describe("isExpiringWithin", () => {
  it("is true when target is within window", () => {
    expect(isExpiringWithin(inTenDays, 30, NOW)).toBe(true);
    expect(isExpiringWithin(inTenDays, 10, NOW)).toBe(true);
  });

  it("is false when target is outside window", () => {
    expect(isExpiringWithin(inSixtyDays, 30, NOW)).toBe(false);
  });

  it("is false when target is already in the past (no pre-warning)", () => {
    expect(isExpiringWithin(yesterday, 30, NOW)).toBe(false);
  });

  it("is false on null/undefined", () => {
    expect(isExpiringWithin(null, 30, NOW)).toBe(false);
    expect(isExpiringWithin(undefined, 30, NOW)).toBe(false);
  });

  it("is false on invalid date string", () => {
    expect(isExpiringWithin("nonsense", 30, NOW)).toBe(false);
  });
});

describe("isExpired", () => {
  it("is true for past dates", () => {
    expect(isExpired(yesterday, NOW)).toBe(true);
    expect(isExpired(lastYear, NOW)).toBe(true);
  });

  it("is false for future dates", () => {
    expect(isExpired(tomorrow, NOW)).toBe(false);
    expect(isExpired(inTenDays, NOW)).toBe(false);
  });

  it("is false on null/undefined", () => {
    expect(isExpired(null, NOW)).toBe(false);
    expect(isExpired(undefined, NOW)).toBe(false);
  });

  it("is false on invalid date string", () => {
    expect(isExpired("nonsense", NOW)).toBe(false);
  });
});
