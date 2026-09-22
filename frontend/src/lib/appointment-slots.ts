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

export function formatTimeSlot(timeStr?: string | null): string {
  if (!timeStr) return "—";
  const str = String(timeStr).trim();
  if (!str) return "—";
  if (str.toUpperCase().includes("AM") || str.toUpperCase().includes("PM")) {
    return str;
  }

  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return str;

  let hour = parseInt(match[1], 10);
  const min = match[2];

  if (isNaN(hour)) return str;

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${min} ${ampm}`;
}

export const VET_OPTIONS: string[] = ["Alfredo B. Badiola, Jr., DVM"];

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
      return "bg-amber-50 text-amber-800 border-amber-300";
    case "approved":
      return "bg-brand-teal-light text-brand-teal border-brand-teal/30";
    case "scheduled":
      return "bg-brand-navy-light text-brand-navy border-brand-navy/20";
    case "completed":
      return "bg-brand-green-light text-brand-green border-brand-green/30";
    case "cancelled":
      return "bg-red-50 text-red-800 border-red-300";
    case "no show":
    case "noshow":
    case "missed":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
