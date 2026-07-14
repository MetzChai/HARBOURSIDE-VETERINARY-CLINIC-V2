export const APPOINTMENT_SLOTS = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
] as const;

export const VET_OPTIONS = ["Dr. Rivera", "Dr. Tan"] as const;

export const CARE_TYPES = ["checkup", "treatment", "vaccine"] as const;
export type CareType = (typeof CARE_TYPES)[number];

export const CARE_TYPE_LABELS: Record<CareType, string> = {
  checkup: "Check-up",
  treatment: "Treatment",
  vaccine: "Vaccine",
};

export function normalizeCareType(value: unknown): CareType {
  const v = String(value ?? "checkup").toLowerCase();
  return (CARE_TYPES as readonly string[]).includes(v) ? (v as CareType) : "checkup";
}

export function isSlotBlockingStatus(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "scheduled" || s === "requested";
}
