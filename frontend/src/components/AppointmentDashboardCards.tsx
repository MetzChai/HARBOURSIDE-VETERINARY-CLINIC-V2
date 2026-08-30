"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { todayPH } from "@/lib/datetime";

interface AppointmentDashboardCardsProps {
  appointments: any[];
}

export default function AppointmentDashboardCards({ appointments = [] }: AppointmentDashboardCardsProps) {
  const today = todayPH();

  const todaysAppointments = appointments.filter(
    (a) => a.date === today && ["Scheduled", "Approved", "Completed", "Pending", "Requested"].includes(a.status)
  ).length;

  const pendingRequests = appointments.filter(
    (a) => a.status === "Pending" || a.status === "Requested"
  ).length;

  const upcomingAppointments = appointments.filter(
    (a) => a.date > today && ["Scheduled", "Approved", "Pending", "Requested"].includes(a.status)
  ).length;

  const completedToday = appointments.filter(
    (a) => a.date === today && a.status === "Completed"
  ).length;

  const cancelledAppointments = appointments.filter(
    (a) => a.status === "Cancelled"
  ).length;

  const cards = [
    {
      title: "Today's Appointments",
      value: todaysAppointments,
      subtitle: `Scheduled for ${today}`,
      icon: Calendar,
      color: "text-brand-navy bg-brand-navy-light border-brand-navy/20",
    },
    {
      title: "Pending Requests",
      value: pendingRequests,
      subtitle: "Awaiting review",
      icon: Clock,
      color: "text-amber-600 bg-amber-50 border-amber-200",
    },
    {
      title: "Upcoming Appointments",
      value: upcomingAppointments,
      subtitle: "Future bookings",
      icon: AlertCircle,
      color: "text-brand-teal bg-brand-teal-light border-brand-teal/30",
    },
    {
      title: "Completed Today",
      value: completedToday,
      subtitle: "Finished & recorded",
      icon: CheckCircle2,
      color: "text-brand-green bg-brand-green-light border-brand-green/30",
    },
    {
      title: "Cancelled Appointments",
      value: cancelledAppointments,
      subtitle: "Cancelled or rejected",
      icon: XCircle,
      color: "text-red-700 bg-red-50 border-red-200",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
              <p className="text-2xl font-bold font-heading">{card.value}</p>
              <p className="text-[11px] text-muted-foreground">{card.subtitle}</p>
            </div>
            <div className={`p-2.5 rounded-xl border ${card.color}`}>
              <card.icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
