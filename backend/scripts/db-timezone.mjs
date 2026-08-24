export const PH_TIMEZONE = "Asia/Manila";

const PG_TIMEZONE_OPTIONS = "options=-c%20TimeZone%3DAsia%2FManila";

export function isInvalidPgTimezone(value) {
  const tz = String(value ?? "").trim();
  if (!tz) return true;
  if (/^gmt/i.test(tz)) return true;
  if (/^[+-]\d{2}:?\d{2}$/.test(tz)) return true;
  if (/^utc[+-]/i.test(tz)) return true;
  return false;
}

export function ensurePhilippineTimezone() {
  for (const key of ["TZ", "PGTZ"]) {
    const current = process.env[key];
    if (!current || isInvalidPgTimezone(current)) {
      process.env[key] = PH_TIMEZONE;
    }
  }
}

function stripTimezoneQueryParams(url) {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return url;

  const base = url.slice(0, qIndex);
  const kept = url
    .slice(qIndex + 1)
    .split("&")
    .filter((part) => {
      const key = part.split("=")[0]?.toLowerCase() ?? "";
      return key !== "timezone" && key !== "pgtz" && key !== "options";
    });

  return kept.length ? `${base}?${kept.join("&")}` : base;
}

export function withDatabaseTimezone(url) {
  if (!url) return url;
  ensurePhilippineTimezone();
  const cleanUrl = stripTimezoneQueryParams(url);
  return cleanUrl.includes("?")
    ? `${cleanUrl}&${PG_TIMEZONE_OPTIONS}`
    : `${cleanUrl}?${PG_TIMEZONE_OPTIONS}`;
}

export function resolveDatabaseUrl() {
  ensurePhilippineTimezone();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return withDatabaseTimezone(url);
}

export function bindPoolTimezone(pool) {
  pool.on("connect", (client) => {
    void client.query(`SET TIME ZONE '${PH_TIMEZONE}'`);
  });
  pool.on("acquire", (client) => {
    void client.query(`SET TIME ZONE '${PH_TIMEZONE}'`);
  });
}
