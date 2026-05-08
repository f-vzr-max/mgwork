import { differenceInCalendarDays, isAfter, isBefore } from "date-fns";

export type DateInput = Date | string | number;

function toDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d);
}

// Whole calendar days from `now` until `date`. Negative when `date` is in the
// past. Past dates and invalid dates return appropriate values; throws on NaN.
export function daysUntil(date: DateInput, now: DateInput = new Date()): number {
  const target = toDate(date);
  const ref = toDate(now);
  if (Number.isNaN(target.getTime()) || Number.isNaN(ref.getTime())) {
    throw new Error("daysUntil: invalid date input");
  }
  return differenceInCalendarDays(target, ref);
}

// True when `date` is non-null, in the future, AND within `days` calendar days
// of `now`. Used by expiry alerts (30 / 15 / 7 day pre-warnings).
export function isExpiringWithin(
  date: DateInput | null | undefined,
  days: number,
  now: DateInput = new Date(),
): boolean {
  if (date == null) return false;
  const target = toDate(date);
  const ref = toDate(now);
  if (Number.isNaN(target.getTime()) || Number.isNaN(ref.getTime())) return false;
  if (!isAfter(target, ref)) return false; // already expired or today → no pre-warning
  return differenceInCalendarDays(target, ref) <= days;
}

// True when `date` is non-null and strictly before `now`.
export function isExpired(date: DateInput | null | undefined, now: DateInput = new Date()): boolean {
  if (date == null) return false;
  const target = toDate(date);
  const ref = toDate(now);
  if (Number.isNaN(target.getTime())) return false;
  return isBefore(target, ref);
}
