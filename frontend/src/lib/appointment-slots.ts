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

export const APPOINTMENT_STATUSES = [
  "Requested",
  "Scheduled",
  "Completed",
  "Missed",
  "Cancelled",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = [
  "Check-up",
  "Vaccination",
  "Treatment",
  "Deworming",
  "Consultation",
] as const;

export type AppointmentTypeOption = (typeof APPOINTMENT_TYPES)[number];

export const CARE_TYPES = ["checkup", "treatment", "vaccine", "vaccination", "deworming", "consultation"] as const;
export type CareType = (typeof CARE_TYPES)[number];

export const CARE_TYPE_LABELS: Record<string, string> = {
  checkup: "Check-up",
  treatment: "Treatment",
  vaccine: "Vaccination",
  vaccination: "Vaccination",
  deworming: "Deworming",
  consultation: "Consultation",
};

export function normalizeCareType(value: unknown): string {
  const v = String(value ?? "checkup").toLowerCase();
  if (v === "vaccine") return "vaccination";
  return (CARE_TYPES as readonly string[]).includes(v) ? v : "checkup";
}

export function isSlotBlockingStatus(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  return s === "scheduled" || s === "approved" || s === "pending" || s === "requested";
}

export function getStatusBadgeClass(status?: string | null): string {
  switch (String(status ?? "").toLowerCase()) {
    case "pending":
    case "requested":
      return "bg-amber-100 text-amber-800 border-amber-300";
    case "approved":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "scheduled":
      return "bg-sky-100 text-sky-800 border-sky-300";
    case "completed":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "cancelled":
      return "bg-rose-100 text-rose-800 border-rose-300";
    case "no show":
    case "noshow":
    case "missed":
      return "bg-slate-100 text-slate-700 border-slate-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}
