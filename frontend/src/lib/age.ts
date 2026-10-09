import { formatDatePH, formatDateTimePH, todayPH, toDateOnly } from "./datetime";

export function getAge(dob?: string | null): { years: number; months: number; weeks: number; days: number } | null {
  if (!dob) return null;
  const birth = toDateOnly(dob);
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;

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
  if (years < 0) return { years: 0, months: 0, weeks: 0, days: 0 };

  const birthDateObj = new Date(Date.UTC(by, bm - 1, bd));
  const todayDateObj = new Date(Date.UTC(ty, tm - 1, td));
  const totalDays = Math.max(0, Math.floor((todayDateObj.getTime() - birthDateObj.getTime()) / (1000 * 60 * 60 * 24)));
  const weeks = Math.floor(totalDays / 7);

  return { years, months, weeks, days: totalDays };
}

export function formatAge(dob?: string | null): string {
  const age = getAge(dob);
  if (!age) return "—";

  const { years, months, weeks, days } = age;

  if (years > 0) {
    if (months > 0) {
      return `${years} yr${years > 1 ? "s" : ""} ${months} mo${months > 1 ? "s" : ""}`;
    }
    return `${years} yr${years > 1 ? "s" : ""}`;
  }

  if (months > 0) {
    return `${months} mo${months > 1 ? "s" : ""}`;
  }

  if (weeks > 0) {
    return `${weeks} wk${weeks > 1 ? "s" : ""}`;
  }

  if (days > 0) {
    return `${days} day${days > 1 ? "s" : ""}`;
  }

  return "Newborn";
}

export function formatDate(d?: string | null): string {
  return formatDatePH(d);
}

export function formatDateTime(d?: string | Date | null): string {
  return formatDateTimePH(d);
}
