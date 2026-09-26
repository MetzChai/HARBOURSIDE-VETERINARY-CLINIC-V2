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

export const CARE_TYPES = ["checkup", "treatment", "vaccine", "vaccination", "deworming"] as const;
export type CareType = (typeof CARE_TYPES)[number];

export const CARE_TYPE_LABELS: Record<string, string> = {
  checkup: "Check-up",
  treatment: "Treatment",
  vaccine: "Vaccination",
  vaccination: "Vaccination",
  deworming: "Deworming",
};

export function normalizeCareType(value: unknown): string {
  const v = String(value ?? "checkup").toLowerCase();
  if (v === "vaccine") return "vaccination";
  if (v === "consultation") return "checkup";
  return (CARE_TYPES as readonly string[]).includes(v) ? v : "checkup";
}

export function isSlotBlockingStatus(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "scheduled" || s === "requested";
}
