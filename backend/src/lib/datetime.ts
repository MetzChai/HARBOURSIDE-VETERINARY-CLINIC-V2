export const PH_TIMEZONE = "Asia/Manila";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD for today in Philippines */
export function todayPH(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PH_TIMEZONE }).format(new Date());
}

/** Normalize DB / input values to YYYY-MM-DD without timezone shift */
export function toDateOnly(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : raw.slice(0, 10);
}

function dateOnlyToUtcNoon(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Days from today in PH (negative = past, 0 = today, positive = future) */
export function daysFromTodayPH(value?: string | null): number | null {
  const target = toDateOnly(value);
  if (!target) return null;
  const diff = dateOnlyToUtcNoon(target).getTime() - dateOnlyToUtcNoon(todayPH()).getTime();
  return Math.round(diff / MS_PER_DAY);
}

export function isOnOrBeforeTodayPH(value?: string | null): boolean {
  const days = daysFromTodayPH(value);
  return days !== null && days <= 0;
}

export function isBeforeTodayPH(value?: string | null): boolean {
  const days = daysFromTodayPH(value);
  return days !== null && days < 0;
}

/** True if date is today or within the next N days (PH) */
export function isWithinDaysFromTodayPH(value: string | null | undefined, withinDays: number): boolean {
  const days = daysFromTodayPH(value);
  return days !== null && days <= withinDays;
}

export function addDaysFromTodayPH(days: number): string {
  const d = dateOnlyToUtcNoon(todayPH());
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

/** Last N months buckets for charts (PH calendar months) */
export function phMonthBuckets(count: number): { key: string; label: string }[] {
  const [y, m] = todayPH().split("-").map(Number);
  const buckets: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1 - i, 1, 12, 0, 0));
    buckets.push({
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString("en-PH", { timeZone: PH_TIMEZONE, month: "short" }),
    });
  }
  return buckets;
}

/** Format a date-only value for display in Philippines */
export function formatDatePH(value?: string | null): string {
  if (!value) return "—";
  const dateOnly = toDateOnly(value);
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return String(value);

  const noonUtc = dateOnlyToUtcNoon(dateOnly);
  return noonUtc.toLocaleDateString("en-PH", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Current date/time string for print headers (PH) */
export function formatNowPH(): string {
  return new Date().toLocaleString("en-PH", {
    timeZone: PH_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** ISO timestamp anchored to noon UTC on today's PH date */
export function nowPHIso(): string {
  return `${todayPH()}T12:00:00.000Z`;
}
