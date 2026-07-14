// Pet age computation helpers

import { formatDatePH, todayPH, toDateOnly } from "./datetime";

export function getAge(dob?: string | null): { years: number; months: number } | null {
  if (!dob) return null;
  const birth = toDateOnly(dob);
  if (!birth) return null;

  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = todayPH().split("-").map(Number);
  if (!by || !bm || !bd || !ty || !tm || !td) return null;

  let years = ty - by;
  let months = tm - bm;
  if (td < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return { years: 0, months: 0 };
  return { years, months };
}

export function formatAge(dob?: string | null): string {
  const age = getAge(dob);
  if (!age) return "—";
  const parts: string[] = [];
  if (age.years > 0) parts.push(`${age.years} yr${age.years > 1 ? "s" : ""}`);
  parts.push(`${age.months} mo${age.months !== 1 ? "s" : ""}`);
  return parts.join(" ");
}

export function formatDate(d?: string | null): string {
  return formatDatePH(d);
}
