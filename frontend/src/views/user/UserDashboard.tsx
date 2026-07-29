"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  PawPrint,
  Calendar,
  Syringe,
  Printer,
  PlusCircle,
  FileText,
  MessageSquare,
  Clock,
  CheckCircle2,
  Bell,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import {
  useMyOwner,
  useMyPets,
  useMyAppointments,
  useMyVaccinations,
  useMyCareRecords,
  useMyDewormings,
} from "@/hooks/useOwnerData";
import { formatAge, formatDate } from "@/lib/age";
import { isWithinDaysFromTodayPH, daysFromTodayPH } from "@/lib/datetime";
import { getStatusBadgeClass } from "@/lib/appointment-slots";
import { useOwnerNotifications } from "@/hooks/useNotifications";

export default function UserDashboard() {
  const { data: owner } = useMyOwner();
  const { data: pets = [] } = useMyPets();
  const { data: appointments = [] } = useMyAppointments();
  const { data: vaccinations = [] } = useMyVaccinations();
  const { data: dewormings = [] } = useMyDewormings();
  const { data: careRecords = [] } = useMyCareRecords();

  const { notifications = [] } = useOwnerNotifications();
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const upcomingAppointments = useMemo(
    () => appointments.filter((a: any) => (daysFromTodayPH(a.date) ?? -1) >= 0 && a.status !== "Cancelled"),
    [appointments]
  );

  const vaccinesDue = useMemo(
    () => vaccinations.filter((v: any) => v.next_due && isWithinDaysFromTodayPH(v.next_due, 30)),
    [vaccinations]
  );

  const dewormingsDue = useMemo(
    () => dewormings.filter((d: any) => d.next_due && isWithinDaysFromTodayPH(d.next_due, 30)),
    [dewormings]
  );

  const getPetStatusBadge = (status?: string | null) => {
    const s = (status ?? "healthy").toLowerCase();
    switch (s) {
      case "under_treatment":
      case "under treatment":
        return <Badge className="bg-amber-500 text-white">Under Treatment</Badge>;
      case "recovered":
        return <Badge className="bg-blue-600 text-white">Recovered</Badge>;
      case "deceased":
        return <Badge variant="destructive">Deceased</Badge>;
      default:
        return <Badge className="bg-emerald-600 text-white">Healthy</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Welcome back, {owner?.name ?? "Pet Owner"}</h2>
          <p className="text-muted-foreground text-sm">
            Overview of your registered pets, medical history, and upcoming clinic visits
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/user/appointments">
            <Button size="sm" className="h-9">
              <PlusCircle className="h-4 w-4 mr-1.5" /> Request Appointment
            </Button>
          </Link>
          <Link href="/user/care-history">
            <Button size="sm" variant="outline" className="h-9">
              <FileText className="h-4 w-4 mr-1.5 text-primary" /> View Care History
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-teal-700 bg-teal-50 border-teal-200 hover:bg-teal-100"
            onClick={() => {
              // Trigger PawBot chatbot opening if available or toast
              const chatBtn = document.querySelector('[data-chat-toggle="true"]') as HTMLButtonElement;
              if (chatBtn) chatBtn.click();
            }}
          >
            <Sparkles className="h-4 w-4 mr-1.5 text-teal-600" /> Open PawBot AI
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <PawPrint className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">{pets.length}</p>
              <p className="text-xs text-muted-foreground font-medium">My Registered Pets</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">{upcomingAppointments.length}</p>
              <p className="text-xs text-muted-foreground font-medium">Upcoming Appointments</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Syringe className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">{vaccinesDue.length}</p>
              <p className="text-xs text-muted-foreground font-medium">Upcoming Vaccinations</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <HeartPulse className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading">{dewormingsDue.length}</p>
              <p className="text-xs text-muted-foreground font-medium">Upcoming Deworming</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Pets Grid */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-primary" /> My Pets
          </CardTitle>
          <Link href="/user/pets">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Pets →
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pets.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No pets registered under your account yet. Please contact the clinic staff to register your pets.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pets.map((pet: any) => (
              <Card key={pet.id} className="border shadow-none hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {pet.name[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-base">{pet.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {pet.species || "Pet"} • {pet.breed || "Crossbreed"}
                        </p>
                      </div>
                    </div>
                    {getPetStatusBadge(pet.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t text-muted-foreground">
                    <div>Gender: <span className="font-medium text-foreground">{pet.gender || "—"}</span></div>
                    <div>Age: <span className="font-medium text-foreground">{pet.dob ? formatAge(pet.dob) : "—"}</span></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Appointments Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Upcoming Appointments
          </CardTitle>
          <Link href="/user/appointments">
            <Button variant="ghost" size="sm" className="text-xs">
              Manage Appointments →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apt #</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingAppointments.slice(0, 5).map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-xs font-bold text-primary">
                    {a.appointment_number || `APT-${a.id.slice(0, 6)}`}
                  </TableCell>
                  <TableCell className="font-semibold">{a.pets?.name || "Pet"}</TableCell>
                  <TableCell className="text-xs">
                    {formatDate(a.date)} at {a.time}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {a.appointment_type || a.care_type || "Check-up"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusBadgeClass(a.status)}>
                      {a.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {upcomingAppointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No upcoming appointments scheduled.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Care History Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Recent Medical Care History
          </CardTitle>
          <Link href="/user/care-history">
            <Button variant="ghost" size="sm" className="text-xs">
              View Full History →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Care Type</TableHead>
                <TableHead>Diagnosis / Details</TableHead>
                <TableHead>Veterinarian / Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {careRecords.slice(0, 5).map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{formatDate(c.date)}</TableCell>
                  <TableCell className="font-semibold text-primary">{c.pets?.name || "Pet"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">
                      {c.care_type || "Check-up"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.diagnosis || c.chief_complaint || "—"}</TableCell>
                  <TableCell className="text-xs">{c.vet || c.staff || "Clinic Staff"}</TableCell>
                </TableRow>
              ))}
              {careRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No medical records logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
