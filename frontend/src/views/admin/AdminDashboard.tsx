"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PawPrint, Users, Calendar, Activity, HeartPulse, Skull } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useRows } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { todayPH, phMonthBuckets } from "@/lib/datetime";

const isCure = (outcome?: string | null) =>
  !!outcome && /(cur|recover|healthy|healed|resolved)/i.test(outcome);

export default function AdminDashboard() {
  const { data: pets = [] } = useRows<any>("pets");
  const { data: owners = [] } = useRows<any>("owners");
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: care = [] } = useRows<any>("care_records");

  const today = todayPH();
  const todayAppointments = appointments.filter((a) => a.date === today);
  const petName = (id: string) => pets.find((p) => p.id === id)?.name ?? "—";
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? "—";

  const deceasedCount = pets.filter((p) => p.status === "deceased").length;
  const cureCount = care.filter((c) => isCure(c.outcome)).length;

  const stats = [
    { label: "Total Pets", value: pets.length, icon: PawPrint, color: "text-primary" },
    { label: "Total Owners", value: owners.length, icon: Users, color: "text-brand-teal" },
    { label: "Recoveries (Cured)", value: cureCount, icon: HeartPulse, color: "text-success" },
    { label: "Deceased", value: deceasedCount, icon: Skull, color: "text-destructive" },
  ];

  // Monthly deaths vs cures for the last 6 months
  const chartData = useMemo(() => {
    const months = phMonthBuckets(6).map((m) => ({ ...m, Deaths: 0, Cures: 0 }));
    const bucket = (dateStr?: string | null) => (dateStr ? months.find((m) => m.key === String(dateStr).slice(0, 7)) : undefined);
    pets.forEach((p) => { if (p.status === "deceased") { const b = bucket(p.deceased_date); if (b) b.Deaths++; } });
    care.forEach((c) => { if (isCure(c.outcome)) { const b = bucket(c.date); if (b) b.Cures++; } });
    return months;
  }, [pets, care]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Clinic overview & health outcomes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold font-heading">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Health Outcomes — Deaths vs Cures (last 6 months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Cures" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Deaths" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Today's appointments */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Today's Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayAppointments.length === 0 && <p className="text-sm text-muted-foreground">No appointments today.</p>}
            {todayAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{petName(apt.pet_id)}</p>
                  <p className="text-xs text-muted-foreground">{ownerName(apt.owner_id)} • {apt.time}</p>
                </div>
                <Badge variant={apt.status === "Completed" ? "default" : apt.status === "Missed" ? "destructive" : "secondary"}>{apt.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent deceased */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Recorded Deaths (cause of death)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Pet</TableHead><TableHead>Date</TableHead><TableHead>Cause of Death</TableHead></TableRow></TableHeader>
            <TableBody>
              {pets.filter((p) => p.status === "deceased").map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.deceased_date ? formatDate(p.deceased_date) : "—"}</TableCell>
                  <TableCell>{p.cause_of_death ?? "—"}</TableCell>
                </TableRow>
              ))}
              {pets.filter((p) => p.status === "deceased").length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No deceased records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

