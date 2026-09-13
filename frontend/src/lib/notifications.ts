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
    const qty = Number(item.quantity ?? 0);
    const reorderLevel = Number(item.reorder_level ?? 5);
    const expDate = item.expiration_date;

    // 1. Out of Stock
    if (qty <= 0) {
      alerts.push({
        id: `inv-oos-${item.id}`,
        title: `Out of Stock: ${item.name}`,
        description: `Current quantity is 0 ${item.unit ?? "units"}. Please reorder immediately.`,
        type: "alert",
        time: "Stock Alert",
        sortKey: -2000,
        link: `/admin/inventory?item=${item.id}`,
      });
    }
    // 2. Low Stock
    else if (qty <= reorderLevel) {
      alerts.push({
        id: `inv-low-${item.id}`,
        title: `Low Stock: ${item.name}`,
        description: `Current stock: ${qty} ${item.unit ?? "units"} (Reorder level: ${reorderLevel})`,
        type: "inventory",
        time: "Stock Alert",
        sortKey: -1000 + qty,
        link: `/admin/inventory?item=${item.id}`,
      });
    }

    // 3. Expiration checks (30, 15, 7 days & expired)
    if (expDate) {
      const days = daysFromTodayPH(expDate);
      if (days !== null) {
        if (isBeforeTodayPH(expDate) || days < 0) {
          alerts.push({
            id: `inv-exp-past-${item.id}`,
            title: `EXPIRED: ${item.name}`,
            description: `Expired on ${formatDate(expDate)} (${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago). Do not use!`,
            type: "alert",
            time: formatDate(expDate),
            sortKey: -3000,
            link: `/admin/inventory?item=${item.id}`,
          });
        } else if (days <= 7) {
          alerts.push({
            id: `inv-exp-7d-${item.id}`,
            title: `Expiring in ${days} day${days === 1 ? "" : "s"}: ${item.name}`,
            description: `Expiration date: ${formatDate(expDate)} — ${qty} ${item.unit ?? "units"} remaining`,
            type: "alert",
            time: formatDate(expDate),
            sortKey: -1500 + days,
            link: `/admin/inventory?item=${item.id}`,
          });
        } else if (days <= 15) {
          alerts.push({
            id: `inv-exp-15d-${item.id}`,
            title: `Expiring in 15 days: ${item.name}`,
            description: `Expires on ${formatDate(expDate)} (${days} days remaining)`,
            type: "inventory",
            time: formatDate(expDate),
            sortKey: -800 + days,
            link: `/admin/inventory?item=${item.id}`,
          });
        } else if (days <= 30) {
          alerts.push({
            id: `inv-exp-30d-${item.id}`,
            title: `Expiring in 30 days: ${item.name}`,
            description: `Expires on ${formatDate(expDate)} (${days} days remaining)`,
            type: "inventory",
            time: formatDate(expDate),
            sortKey: -500 + days,
            link: `/admin/inventory?item=${item.id}`,
          });
        }
      }
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
        link: "/admin/care-history",
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
  messages?: any[];
}): NotificationItem[] {
  const messageNotices = (data.messages ?? [])
    .filter((m) => String(m.sent_by || "").toLowerCase() !== "owner" && String(m.status || "").toUpperCase() !== "PENDING")
    .slice(0, 8)
    .map((m) => ({
      id: `msg-${m.id}`,
      title: m.subject || m.message_type || "Clinic message",
      description: String(m.body || "").slice(0, 120),
      type: "alert" as const,
      time: formatDate(m.sent_at || m.created_at),
      sortKey: -400,
      link: "/user/messages",
    }));

  return sortNotifications([
    ...messageNotices,
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
  messages?: any[];
}): NotificationItem[] {
  const ownerReplies = (data.messages ?? [])
    .filter((m) => String(m.sent_by || "").toLowerCase() === "owner")
    .slice(0, 8)
    .map((m) => ({
      id: `msg-${m.id}`,
      title: m.subject || "Owner message",
      description: String(m.body || "").slice(0, 120),
      type: "alert" as const,
      time: formatDate(m.sent_at || m.created_at),
      sortKey: -450,
      link: "/admin/messages",
    }));

  return sortNotifications([
    ...ownerReplies,
    ...requestedAppointmentNotifications(data.appointments, "/admin/schedule"),
    ...vaccineNotifications(data.vaccinations, "/admin/care-history"),
    ...appointmentNotifications(data.appointments, "/admin/schedule", true),
    ...inventoryNotifications(data.inventory),
    ...dewormingNotifications(data.dewormings),
  ]);
}
