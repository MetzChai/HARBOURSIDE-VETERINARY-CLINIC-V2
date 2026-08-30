"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  PawPrint,
  Users,
  Calendar,
  Activity,
  HeartPulse,
  Skull,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  UserPlus,
  PlusCircle,
  FileText,
  PackagePlus,
  Bell,
  Eye,
  TrendingUp,
  TrendingDown,
  Syringe,
  Pill,
  ShieldAlert,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { todayPH, phMonthBuckets, daysFromTodayPH, isBeforeTodayPH, isWithinDaysFromTodayPH, toDateOnly } from "@/lib/datetime";
import { getStatusBadgeClass, CARE_TYPE_LABELS, normalizeCareType } from "@/lib/appointment-slots";
import { useAdminNotifications } from "@/hooks/useNotifications";
import { type NotificationItem } from "@/lib/notifications";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/db-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";

const COLORS = ["#1B3A5C", "#1FA8A8", "#2E7D32", "#C62828", "#8E24AA", "#F57C00"];

function normalizePetHealthStatus(pet: { health_status?: string | null; status?: string | null }) {
  const raw = pet.health_status ?? pet.status ?? "Healthy";
  const s = String(raw).toLowerCase().replace(/\s+/g, "_");
  if (s === "deceased") return "deceased";
  if (s === "under_treatment") return "under_treatment";
  if (s === "recovered") return "recovered";
  return "healthy";
}

function isAppointmentCompleted(status?: string | null) {
  return String(status ?? "").toLowerCase() === "completed";
}

function isRecoveryOutcome(outcome?: string | null) {
  return /(recover|recovered|healed|resolved|cured|improved)/i.test(String(outcome ?? ""));
}

export default function AdminDashboard() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const invalidate = useInvalidate();

  const { data: pets = [], isLoading } = useRows<any>("pets");
  const { data: owners = [] } = useRows<any>("owners");
  const { data: staffAccounts = [] } = useRows<any>("profiles");
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: care = [] } = useRows<any>("care_records", { orderBy: "date", ascending: false });
  const { data: inventory = [] } = useRows<any>("inventory_items");
  const { data: vaccinations = [] } = useRows<any>("vaccinations");
  const { data: dewormings = [] } = useRows<any>("dewormings");

  const { notifications = [] } = useAdminNotifications();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const today = todayPH();

  // Metrics computation
  const todayAppointments = useMemo(
    () => appointments.filter((a) => toDateOnly(a.date) === today),
    [appointments, today]
  );

  const pendingRequests = useMemo(
    () => appointments.filter((a) => a.status === "Pending" || a.status === "Requested"),
    [appointments]
  );

  const completedToday = useMemo(
    () => appointments.filter((a) => toDateOnly(a.date) === today && isAppointmentCompleted(a.status)),
    [appointments, today]
  );

  // Pet Health Statuses
  const healthyPetsCount = useMemo(
    () => pets.filter((p) => normalizePetHealthStatus(p) === "healthy").length,
    [pets]
  );
  const underTreatmentCount = useMemo(
    () => pets.filter((p) => normalizePetHealthStatus(p) === "under_treatment").length,
    [pets]
  );
  const recoveredPetsCount = useMemo(
    () => pets.filter((p) => normalizePetHealthStatus(p) === "recovered").length,
    [pets]
  );
  const deceasedPetsCount = useMemo(
    () => pets.filter((p) => normalizePetHealthStatus(p) === "deceased").length,
    [pets]
  );

  // Recovery & Death Rates
  const totalCases = useMemo(() => pets.length || 1, [pets.length]);
  const recoveryRate = useMemo(
    () => Math.round((recoveredPetsCount / totalCases) * 100),
    [recoveredPetsCount, totalCases]
  );
  const deathRate = useMemo(
    () => Math.round((deceasedPetsCount / totalCases) * 100),
    [deceasedPetsCount, totalCases]
  );

  // Inventory stats
  const lowStockItems = useMemo(
    () => inventory.filter((i) => (i.quantity ?? 0) <= (i.reorder_level ?? 5)),
    [inventory]
  );

  const expiringItems = useMemo(
    () => inventory.filter((i) => i.expiration_date && isWithinDaysFromTodayPH(i.expiration_date, 30)),
    [inventory]
  );

  const petName = (id?: string) => pets.find((p) => p.id === id)?.name ?? "—";
  const ownerName = (id?: string) => owners.find((o) => o.id === id)?.name ?? "—";

  // Summary Stat Cards Data (8 simplified cards)
  const completedAppointments = useMemo(
    () => appointments.filter((a) => isAppointmentCompleted(a.status)),
    [appointments]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (a) => (daysFromTodayPH(a.date) ?? -1) > 0 && a.status !== "Cancelled" && a.status !== "Completed"
      ),
    [appointments]
  );

  const outOfStockItems = useMemo(
    () => inventory.filter((i) => (i.quantity ?? 0) <= 0),
    [inventory]
  );

  const expiredItems = useMemo(
    () => inventory.filter((i) => i.expiration_date && isBeforeTodayPH(i.expiration_date)),
    [inventory]
  );

  const summaryCards = [
    { label: "Total Pets", value: pets.length, icon: PawPrint, variant: "default" as const },
    { label: "Total Owners", value: owners.length, icon: Users, variant: "info" as const },
    { label: "Today's Appointments", value: todayAppointments.length, icon: Calendar, variant: "info" as const },
    { label: "Requested Appointments", value: pendingRequests.length, icon: Clock, variant: "warning" as const },
    { label: "Completed Appointments", value: completedAppointments.length, icon: CheckCircle2, variant: "success" as const },
    { label: "Inventory Items", value: inventory.length, icon: Package, variant: "default" as const },
    { label: "Low Stock", value: lowStockItems.length, icon: AlertTriangle, variant: "warning" as const },
    { label: "Expiring Inventory", value: expiringItems.length, icon: ShieldAlert, variant: "danger" as const },
  ];

  // Analytics Chart Data
  const monthBuckets = useMemo(() => phMonthBuckets(6), []);

  // 1. Appointments Monthly Analytics
  const appointmentMonthlyData = useMemo(() => {
    return monthBuckets.map((m) => {
      const monthAppts = appointments.filter((a) => toDateOnly(a.date).slice(0, 7) === m.key);
      const count = monthAppts.filter((a) => String(a.status ?? "").toLowerCase() !== "cancelled").length;
      const completed = monthAppts.filter((a) => isAppointmentCompleted(a.status)).length;
      return { label: m.label, Total: count, Completed: completed };
    });
  }, [monthBuckets, appointments]);

  // 2. Care History Breakdown
  const careTypeDistribution = useMemo(() => {
    const counts: Record<string, number> = { Checkup: 0, Vaccination: 0, Treatment: 0, Deworming: 0 };
    care.forEach((c) => {
      const t = normalizeCareType(c.record_type ?? c.care_type);
      if (t === "vaccination" || t === "vaccine") counts.Vaccination++;
      else if (t === "treatment") counts.Treatment++;
      else if (t === "deworming") counts.Deworming++;
      else counts.Checkup++;
    });
    return [
      { name: "Check-ups", value: counts.Checkup },
      { name: "Vaccinations", value: counts.Vaccination },
      { name: "Treatments", value: counts.Treatment },
      { name: "Dewormings", value: counts.Deworming },
    ];
  }, [care]);

  // 3. Pet Health & Outcome Analytics
  const petHealthDistribution = useMemo(() => {
    return [
      { name: "Healthy", value: healthyPetsCount },
      { name: "Under Treatment", value: underTreatmentCount },
      { name: "Recovered", value: recoveredPetsCount },
      { name: "Deceased", value: deceasedPetsCount },
    ];
  }, [healthyPetsCount, underTreatmentCount, recoveredPetsCount, deceasedPetsCount]);

  // Monthly Recoveries vs Deaths
  const healthTrendsData = useMemo(() => {
    return monthBuckets.map((m) => {
      const deaths = pets.filter((p) => {
        if (normalizePetHealthStatus(p) !== "deceased") return false;
        const deathDate = toDateOnly(p.deceased_date);
        return deathDate && deathDate.slice(0, 7) === m.key;
      }).length;
      const cures = care.filter((c) => {
        const careMonth = toDateOnly(c.date).slice(0, 7);
        return careMonth === m.key && isRecoveryOutcome(c.outcome);
      }).length;
      return { label: m.label, Recoveries: cures, Deaths: deaths };
    });
  }, [monthBuckets, pets, care]);

  // 4. Inventory Stock & Categories Analytics
  const inventoryCategoryData = useMemo(() => {
    const counts: Record<string, number> = { Medicine: 0, Vaccine: 0, Dewormer: 0, Supply: 0 };
    inventory.forEach((i) => {
      const cat = String(i.category || "").toLowerCase();
      if (cat.includes("vaccin")) counts.Vaccine++;
      else if (cat.includes("deworm")) counts.Dewormer++;
      else if (cat.includes("suppl")) counts.Supply++;
      else counts.Medicine++;
    });
    return [
      { name: "Medicines", value: counts.Medicine },
      { name: "Vaccines", value: counts.Vaccine },
      { name: "Dewormers", value: counts.Dewormer },
      { name: "Medical Supplies", value: counts.Supply },
    ];
  }, [inventory]);

  // Upcoming Reminders computation
  const upcomingVaccines = useMemo(
    () => vaccinations.filter((v) => v.next_due && isWithinDaysFromTodayPH(v.next_due, 30)),
    [vaccinations]
  );
  const upcomingDewormings = useMemo(
    () => dewormings.filter((d) => d.next_due && isWithinDaysFromTodayPH(d.next_due, 30)),
    [dewormings]
  );
  const upcomingAppointmentsList = useMemo(
    () => appointments.filter((a) => (daysFromTodayPH(a.date) ?? -1) >= 0 && a.status !== "Cancelled"),
    [appointments]
  );

  const router = useRouter();

  const updateAppointmentStatus = async (id: string, status: string) => {
    const targetApt = appointments.find((a) => a.id === id);
    if (!targetApt) return;

    if (status === "Completed") {
      const petId = targetApt.pet_id;
      const pet = pets.find((p) => p.id === petId);
      const ownerId = targetApt.owner_id || pet?.owner_id;
      const apptType = targetApt.care_type || targetApt.appointment_type || targetApt.type;
      const reason = targetApt.reason?.trim();

      const missing: string[] = [];
      if (!petId) missing.push("Pet");
      if (!ownerId) missing.push("Owner");
      if (!apptType) missing.push("Appointment Type");
      if (!reason) missing.push("Reason for Visit");

      if (missing.length > 0) {
        toast.error(`Cannot complete appointment: ${missing.join(", ")} missing.`);
        return;
      }
    }

    const nextStatus = status === "Approved" ? "Scheduled" : status;
    const { error } = await db.from("appointments").update({ status: nextStatus } as any).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (status === "Completed") {
      toast.success("Appointment marked as Completed.");
      invalidate("appointments");
      invalidate("care_records");
      router.push(`/admin/care-history?aptId=${id}`);
    } else {
      toast.success(`Appointment status updated to ${nextStatus}.`);
      invalidate("appointments");
    }
  };

  if (isLoading) {
    return <PageSkeleton rows={8} showStats />;
  }

  return (
    <div className="page-container pb-10">
      <PageHeader
        title="Clinic Dashboard"
        description="Real-time operations, appointments, inventory alerts, and clinic analytics"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/pets">
                <PawPrint className="h-4 w-4" /> Register Pet
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/schedule">
                <PlusCircle className="h-4 w-4" /> Book Appointment
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/care-history">
                <FileText className="h-4 w-4" /> Record Care History
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <StatCard
            key={card.label}
            title={card.label}
            value={card.value}
            icon={card.icon}
            variant={card.variant}
          />
        ))}
      </div>

      {/* Analytics Tabs Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-teal" /> Analytics & Health Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="appointments" className="space-y-4">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="appointments" className="text-xs">Appointments</TabsTrigger>
              <TabsTrigger value="care" className="text-xs">Care History</TabsTrigger>
              <TabsTrigger value="health" className="text-xs">Pet Health & Recovery</TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs">Inventory Breakdown</TabsTrigger>
            </TabsList>

            {/* 1. Appointments Analytics */}
            <TabsContent value="appointments" className="space-y-4">
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={appointmentMonthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Total" fill="#1B3A5C" radius={[4, 4, 0, 0]} name="Total Appointments" />
                    <Bar dataKey="Completed" fill="#2E7D32" radius={[4, 4, 0, 0]} name="Completed Appointments" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* 2. Care History Analytics */}
            <TabsContent value="care" className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={careTypeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {careTypeDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Care Services Distribution</h4>
                {careTypeDistribution.map((item, idx) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span>{item.name}</span>
                      <span>{item.value} records</span>
                    </div>
                    <Progress value={care.length ? (item.value / care.length) * 100 : 0} className="h-2" />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* 3. Pet Health & Recovery/Death Analytics */}
            <TabsContent value="health" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border bg-brand-green-light/70 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase">Recovery Rate</span>
                  <p className="text-3xl font-bold font-heading text-brand-green">{recoveryRate}%</p>
                  <p className="text-xs text-brand-green">{recoveredPetsCount} total pets marked as Recovered</p>
                </div>
                <div className="p-4 rounded-xl border bg-red-50/70 space-y-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase">Death Rate</span>
                  <p className="text-3xl font-bold font-heading text-red-700">{deathRate}%</p>
                  <p className="text-xs text-red-800">{deceasedPetsCount} total deceased records</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={petHealthDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {petHealthDistribution.map((_, index) => (
                          <Cell key={`cell-health-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Pet Health Status</h4>
                  {petHealthDistribution.map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{item.name}</span>
                        <span>{item.value} pets</span>
                      </div>
                      <Progress value={pets.length ? (item.value / pets.length) * 100 : 0} className="h-2" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={healthTrendsData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" className="text-xs" />
                    <YAxis allowDecimals={false} className="text-xs" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Recoveries" stroke="#2E7D32" strokeWidth={2} />
                    <Line type="monotone" dataKey="Deaths" stroke="#C62828" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            {/* 4. Inventory Analytics */}
            <TabsContent value="inventory" className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={inventoryCategoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                      {inventoryCategoryData.map((_, index) => (
                        <Cell key={`cell-inv-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border bg-amber-50 text-amber-900">
                    <span className="text-xs font-semibold block">Low Stock Items</span>
                    <span className="text-xl font-bold">{lowStockItems.length}</span>
                  </div>
                  <div className="p-3 rounded-lg border bg-rose-50 text-rose-900">
                    <span className="text-xs font-semibold block">Expiring Items</span>
                    <span className="text-xl font-bold">{expiringItems.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold uppercase text-muted-foreground">Inventory Items Overview</h5>
                  <p className="text-xs text-muted-foreground">
                    Monitoring medicines, vaccines, dewormers, and medical supplies reorder thresholds.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-teal" /> Appointments
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link href="/admin/schedule">View schedule</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="today" className="space-y-3">
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="today">Today ({todayAppointments.length})</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming ({upcomingAppointments.length})</TabsTrigger>
              <TabsTrigger value="requested">Requested ({pendingRequests.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedAppointments.length})</TabsTrigger>
            </TabsList>
            {(
              [
                ["today", todayAppointments],
                ["upcoming", upcomingAppointments],
                ["requested", pendingRequests],
                ["completed", completedAppointments],
              ] as const
            ).map(([key, list]) => (
              <TabsContent key={key} value={key} className="p-0 mt-0">
                {list.length === 0 ? (
                  <EmptyState title="No appointments found." description="There are no appointments in this list right now." />
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Apt #</TableHead>
                          <TableHead>Pet</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right pr-4">Quick Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.slice(0, 8).map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-mono text-xs font-bold text-brand-navy">
                              {a.appointment_number || `APT-${a.id.slice(0, 6)}`}
                            </TableCell>
                            <TableCell className="font-semibold">{petName(a.pet_id)}</TableCell>
                            <TableCell>{ownerName(a.owner_id)}</TableCell>
                            <TableCell className="text-xs">
                              {formatDate(a.date)} at {a.time}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusBadgeClass(a.status)}>
                                {a.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-1">
                                {(a.status === "Pending" || a.status === "Requested") && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => updateAppointmentStatus(a.id, "Scheduled")}
                                  >
                                    Approve
                                  </Button>
                                )}
                                {a.status !== "Completed" && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => updateAppointmentStatus(a.id, "Completed")}
                                  >
                                    Complete
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Grid Section: Reminders & Low Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Reminders Widget */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" /> Upcoming Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase text-muted-foreground">Vaccinations Due (Next 30 Days)</h5>
              {upcomingVaccines.slice(0, 3).map((v) => (
                <div key={v.id} className="flex justify-between items-center text-xs p-2 rounded border bg-card">
                  <span>
                    <strong>{v.pets?.name || petName(v.pet_id)}</strong> — {v.vaccine_type}
                  </span>
                  <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                    Due {formatDate(v.next_due)}
                  </Badge>
                </div>
              ))}
              {upcomingVaccines.length === 0 && (
                <p className="text-xs text-muted-foreground">No upcoming vaccination reminders.</p>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t">
              <h5 className="text-xs font-bold uppercase text-muted-foreground">Dewormings Due (Next 30 Days)</h5>
              {upcomingDewormings.slice(0, 3).map((d) => (
                <div key={d.id} className="flex justify-between items-center text-xs p-2 rounded border bg-card">
                  <span>
                    <strong>{d.pets?.name || petName(d.pet_id)}</strong> — {d.product || "Deworming"}
                  </span>
                  <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200">
                    Due {formatDate(d.next_due)}
                  </Badge>
                </div>
              ))}
              {upcomingDewormings.length === 0 && (
                <p className="text-xs text-muted-foreground">No upcoming deworming reminders.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Inventory Alert Widget */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> Inventory Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link href="/admin/inventory">Manage inventory</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3 bg-amber-50">
                <p className="text-[10px] uppercase font-semibold text-amber-800">Low Stock</p>
                <p className="font-heading text-xl font-bold text-amber-800">{lowStockItems.length}</p>
              </div>
              <div className="rounded-lg border p-3 bg-muted">
                <p className="text-[10px] uppercase font-semibold text-brand-charcoal">Out of Stock</p>
                <p className="font-heading text-xl font-bold text-brand-charcoal">{outOfStockItems.length}</p>
              </div>
              <div className="rounded-lg border p-3 bg-amber-50">
                <p className="text-[10px] uppercase font-semibold text-amber-800">Expiring Soon</p>
                <p className="font-heading text-xl font-bold text-amber-800">{expiringItems.length}</p>
              </div>
              <div className="rounded-lg border p-3 bg-red-50">
                <p className="text-[10px] uppercase font-semibold text-red-800">Expired</p>
                <p className="font-heading text-xl font-bold text-red-800">{expiredItems.length}</p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockItems.concat(expiringItems).slice(0, 5).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-semibold text-xs">{item.name}</TableCell>
                    <TableCell className="font-bold text-red-700">{item.quantity ?? 0}</TableCell>
                    <TableCell className="text-xs">{item.reorder_level ?? 5}</TableCell>
                    <TableCell className="text-xs">{item.expiration_date ? formatDate(item.expiration_date) : "—"}</TableCell>
                  </TableRow>
                ))}
                {lowStockItems.length === 0 && expiringItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      All inventory stock levels are healthy.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
