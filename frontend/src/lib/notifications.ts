import { formatDate } from "@/lib/age";
import { daysFromTodayPH, isBeforeTodayPH, isWithinDaysFromTodayPH } from "@/lib/datetime";

export type NotificationType = "vaccine" | "appointment" | "inventory" | "alert";

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  type: NotificationType;
  time: string;
  sortKey: number;
  link?: string;
}

export function isScheduledStatus(status?: string | null) {
  return (status ?? "").toLowerCase() === "scheduled";
}

function vaccineNotifications(vaccinations: any[], link: string): NotificationItem[] {
  return vaccinations
    .filter((v) => v.next_due && isWithinDaysFromTodayPH(v.next_due, 30))
    .map((v) => {
      const days = daysFromTodayPH(v.next_due) ?? 0;
      const overdue = days < 0;
      const petName = v.pets?.name ?? "Pet";
      return {
        id: `vac-${v.id}`,
        title: overdue
          ? `${petName} — ${v.vaccine_type} overdue`
          : `${petName} — ${v.vaccine_type} due soon`,
        description: overdue
          ? `Was due ${formatDate(v.next_due)} (${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago)`
          : `Due ${formatDate(v.next_due)} (${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`})`,
        type: "vaccine" as const,
        time: formatDate(v.next_due),
        sortKey: days,
        link,
      };
    });
}

function appointmentNotifications(
  appointments: any[],
  link: string,
  includeOwner = false
): NotificationItem[] {
  return appointments
    .filter((a) => isScheduledStatus(a.status) && (daysFromTodayPH(a.date) ?? -1) >= 0)
    .map((a) => {
      const days = daysFromTodayPH(a.date) ?? 0;
      const petName = a.pets?.name ?? "Pet";
      const ownerPart = includeOwner && a.owners?.name ? ` • ${a.owners.name}` : "";
      return {
        id: `apt-${a.id}`,
        title: days === 0 ? `Today: ${petName}` : `Upcoming: ${petName}`,
        description: `${a.reason ?? "Visit"}${ownerPart} — ${formatDate(a.date)} at ${a.time ?? "—"}`,
        type: "appointment" as const,
        time: formatDate(a.date),
        sortKey: days,
        link,
      };
    });
}

function requestedAppointmentNotifications(appointments: any[], link: string): NotificationItem[] {
  return appointments
    .filter((a) => (a.status ?? "") === "Requested")
    .map((a) => {
      const petName = a.pets?.name ?? "Pet";
      const ownerPart = a.owners?.name ? ` • ${a.owners.name}` : "";
      return {
        id: `apt-req-${a.id}`,
        title: `Request: ${petName}`,
        description: `${a.reason ?? "Visit request"}${ownerPart} — ${formatDate(a.date)} at ${a.time ?? "—"}`,
        type: "alert" as const,
        time: formatDate(a.date),
        sortKey: -500 + (daysFromTodayPH(a.date) ?? 0),
        link,
      };
    });
}

function inventoryNotifications(items: any[]): NotificationItem[] {
  const alerts: NotificationItem[] = [];

  for (const item of items) {
    const qty = item.quantity ?? 0;

    if (item.expiration_date && isBeforeTodayPH(item.expiration_date)) {
      alerts.push({
        id: `inv-exp-${item.id}`,
        title: `${item.name} expired`,
        description: `Expired ${formatDate(item.expiration_date)} — ${qty} ${item.unit ?? "units"} left`,
        type: "alert",
        time: formatDate(item.expiration_date),
        sortKey: -1000 + (daysFromTodayPH(item.expiration_date) ?? 0),
        link: "/admin/inventory",
      });
    } else if (qty <= 5) {
      alerts.push({
        id: `inv-low-${item.id}`,
        title: `${item.name}: low stock`,
        description: `${qty} ${item.unit ?? "units"} remaining`,
        type: "inventory",
        time: formatDate(item.expiration_date) !== "—" ? `Expires ${formatDate(item.expiration_date)}` : "Check inventory",
        sortKey: qty,
        link: "/admin/inventory",
      });
    }
  }

  return alerts;
}

function dewormingNotifications(dewormings: any[]): NotificationItem[] {
  return dewormings
    .filter((d) => {
      if ((d.status ?? "").toLowerCase() === "completed") return false;
      return d.next_due && isWithinDaysFromTodayPH(d.next_due, 14);
    })
    .map((d) => {
      const days = daysFromTodayPH(d.next_due) ?? 0;
      const overdue = days < 0;
      const petName = d.pets?.name ?? "Pet";
      return {
        id: `dew-${d.id}`,
        title: overdue ? `${petName} deworming overdue` : `${petName} deworming due`,
        description: `${d.product ?? "Treatment"} — ${overdue ? `was due ${formatDate(d.next_due)}` : `due ${formatDate(d.next_due)}`}`,
        type: "alert" as const,
        time: formatDate(d.next_due),
        sortKey: days,
        link: "/admin/dewormings",
      };
    });
}

function sortNotifications(items: NotificationItem[]) {
  return [...items].sort((a, b) => a.sortKey - b.sortKey);
}

export function buildOwnerNotifications(data: {
  vaccinations: any[];
  appointments: any[];
  dewormings: any[];
}): NotificationItem[] {
  return sortNotifications([
    ...vaccineNotifications(data.vaccinations, "/user/vaccinations"),
    ...appointmentNotifications(data.appointments, "/user/appointments"),
    ...requestedAppointmentNotifications(data.appointments, "/user/appointments").map((n) => ({
      ...n,
      title: n.title.replace("Request: ", "Pending: "),
    })),
    ...dewormingNotifications(data.dewormings).map((n) => ({
      ...n,
      link: "/user",
    })),
  ]);
}

export function buildAdminNotifications(data: {
  vaccinations: any[];
  appointments: any[];
  inventory: any[];
  dewormings: any[];
}): NotificationItem[] {
  return sortNotifications([
    ...requestedAppointmentNotifications(data.appointments, "/admin/schedule"),
    ...vaccineNotifications(data.vaccinations, "/admin/care-history"),
    ...appointmentNotifications(data.appointments, "/admin/schedule", true),
    ...inventoryNotifications(data.inventory),
    ...dewormingNotifications(data.dewormings),
  ]);
}
