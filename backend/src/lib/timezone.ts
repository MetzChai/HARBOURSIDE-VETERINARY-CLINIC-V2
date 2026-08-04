export const PH_TIMEZONE = "Asia/Manila";

/** Windows often sets TZ/PGTZ to "GMT+0800", which PostgreSQL rejects. */
function isInvalidPgTimezone(value: string): boolean {
  const tz = value.trim();
  if (!tz) return true;
  if (/gmt/i.test(tz)) return true;
  if (/^[+-]\d{2}:?\d{2}$/.test(tz)) return true;
  if (/^utc[+-]/i.test(tz)) return true;
  return false;
}

export function ensurePhilippineTimezone(): void {
  for (const key of ["TZ", "PGTZ"] as const) {
    const current = process.env[key];
    if (!current || isInvalidPgTimezone(current)) {
      process.env[key] = PH_TIMEZONE;
    }
  }
}

export function withDatabaseTimezone(url: string): string {
  if (/timezone=/i.test(url) || /TimeZone=/i.test(url)) return url;
  const param = "options=-c%20TimeZone%3DAsia%2FManila";
  return url.includes("?") ? `${url}&${param}` : `${url}?${param}`;
}
