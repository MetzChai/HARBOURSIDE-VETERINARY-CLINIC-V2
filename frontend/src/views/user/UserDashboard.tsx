"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PawPrint,
  Calendar,
  Syringe,
  PlusCircle,
  FileText,
  Clock,
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
import { getStatusBadgeClass, formatTimeSlot } from "@/lib/appointment-slots";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";

export default function UserDashboard() {
  const { data: owner } = useMyOwner();
  const { data: pets = [] } = useMyPets();
  const { data: appointments = [] } = useMyAppointments();
  const { data: vaccinations = [] } = useMyVaccinations();
  const { data: dewormings = [] } = useMyDewormings();
  const { data: careRecords = [] } = useMyCareRecords();

  const upcomingAppointments = useMemo(
    () => appointments.filter((a: any) => (daysFromTodayPH(a.date) ?? -1) >= 0 && a.status !== "Cancelled"),
    [appointments]
  );

  const requestedAppointments = useMemo(
    () => appointments.filter((a: any) => a.status === "Requested" || a.status === "Pending"),
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
        return <Badge className="bg-brand-teal text-white">Recovered</Badge>;
      case "deceased":
        return <Badge variant="destructive">Deceased</Badge>;
      default:
        return <Badge className="bg-brand-green text-white">Healthy</Badge>;
    }
  };

  return (
    <div className="page-container pb-10 space-y-6">
      {/* Harbourside Branded Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4A0A10] via-[#7F1D1D] to-[#E5192C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-rose-200 text-xs font-semibold backdrop-blur-sm border border-white/10">
              <Sparkles className="h-3.5 w-3.5" /> Harbourside Pet Owner Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight text-white">
              Welcome back, {owner?.name ?? "Pet Owner"}! 👋
            </h1>
            <p className="text-sm text-slate-200/90 leading-relaxed">
              Keep track of your pets' wellness, manage upcoming clinic visits, review medical history, and get quick AI assistance from PawBot.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button size="sm" className="bg-[#E5192C] hover:bg-[#C51124] text-white shadow-md font-semibold border border-rose-300/30" asChild>
              <Link href="/user/appointments">
                <PlusCircle className="h-4 w-4 mr-1.5" /> Request Appointment
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm" asChild>
              <Link href="/user/care-history">
                <FileText className="h-4 w-4 mr-1.5" /> View Care History
              </Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-[#7F1D1D] hover:bg-slate-100 font-semibold shadow"
              onClick={() => {
                const chatBtn = document.querySelector('[data-chat-toggle="true"]') as HTMLButtonElement;
                if (chatBtn) chatBtn.click();
              }}
            >
              <Sparkles className="h-4 w-4 mr-1.5 text-[#E5192C]" /> PawBot AI
            </Button>
          </div>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="My Registered Pets" value={pets.length} icon={PawPrint} variant="default" />
        <StatCard title="Upcoming Visits" value={upcomingAppointments.length} icon={Calendar} variant="info" />
        <StatCard title="Pending Requests" value={requestedAppointments.length} icon={Clock} variant="warning" />
        <StatCard title="Medical Records" value={careRecords.length} icon={FileText} variant="success" />
        <StatCard title="Vaccines Due" value={vaccinesDue.length} icon={Syringe} variant="warning" />
        <StatCard title="Deworming Due" value={dewormingsDue.length} icon={HeartPulse} variant="success" />
      </div>

      {/* My Pets Grid */}
      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between bg-slate-50/60 border-b">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[#7F1D1D]">
            <PawPrint className="h-5 w-5 text-[#E5192C]" /> My Registered Pets ({pets.length})
          </CardTitle>
          <Link href="/user/pets">
            <Button variant="ghost" size="sm" className="text-xs text-[#E5192C] hover:text-[#7F1D1D] font-semibold">
              Manage All Pets →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-4">
          {pets.length === 0 && (
            <EmptyState
              icon={PawPrint}
              title="No pets registered yet"
              description="Please contact the clinic staff to register your pets."
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pets.map((pet: any) => (
              <Card key={pet.id} className="group hover:shadow-md hover:border-[#E5192C]/50 transition-all duration-200 border-border/70 rounded-xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-[#FEE2E2] border-2 border-[#E5192C]/40 flex items-center justify-center font-heading font-bold text-[#7F1D1D] overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                        {pet.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pet.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          pet.name[0]
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-base text-[#7F1D1D] group-hover:text-[#E5192C] transition-colors">{pet.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {pet.species || "Pet"} • {pet.breed || "Crossbreed"}
                        </p>
                      </div>
                    </div>
                    {getPetStatusBadge(pet.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t text-muted-foreground">
                    <div>Gender: <span className="font-medium text-foreground">{pet.gender || "—"}</span></div>
                    <div>Age: <span className="font-medium text-foreground">{pet.dob ? formatAge(pet.dob) : "—"}</span></div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs font-semibold text-[#7F1D1D] hover:bg-[#FEE2E2] hover:border-[#7F1D1D]/30" asChild>
                    <Link href="/user/pets">View Profile & History</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Appointments Table */}
      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between bg-slate-50/60 border-b">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[#7F1D1D]">
            <Calendar className="h-5 w-5 text-[#E5192C]" /> Upcoming Appointments
          </CardTitle>
          <Link href="/user/appointments">
            <Button variant="ghost" size="sm" className="text-xs text-[#E5192C] hover:text-[#7F1D1D] font-semibold">
              Manage Appointments →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FEE2E2]/70 hover:bg-[#FEE2E2]/70">
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Apt #</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Pet</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Date & Time</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Type</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingAppointments.slice(0, 5).map((a: any) => (
                <TableRow key={a.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-mono text-xs font-bold text-[#7F1D1D]">
                    {a.appointment_number || `APT-${a.id.slice(0, 6)}`}
                  </TableCell>
                  <TableCell className="font-semibold text-xs">{a.pets?.name || "Pet"}</TableCell>
                  <TableCell className="text-xs">
                    {formatDate(a.date)} at {formatTimeSlot(a.time)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs border-[#E5192C]/40 text-[#7F1D1D]">
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                    No upcoming appointments scheduled.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Care History Section */}
      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between bg-slate-50/60 border-b">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[#7F1D1D]">
            <FileText className="h-5 w-5 text-[#E5192C]" /> Recent Care Records
          </CardTitle>
          <Link href="/user/care-history">
            <Button variant="ghost" size="sm" className="text-xs text-[#E5192C] hover:text-[#7F1D1D] font-semibold">
              View Full History →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FEE2E2]/70 hover:bg-[#FEE2E2]/70">
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Date</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Pet</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Care Type</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Diagnosis / Details</TableHead>
                <TableHead className="text-[#7F1D1D] font-bold text-xs">Veterinarian / Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {careRecords.slice(0, 5).map((c: any) => (
                <TableRow key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-xs">{formatDate(c.date)}</TableCell>
                  <TableCell className="font-semibold text-xs text-[#7F1D1D]">{c.pets?.name || "Pet"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs border-[#E5192C]/30 bg-[#FFF1F2] text-[#7F1D1D]">
                      {c.care_type || "Check-up"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{c.diagnosis || c.chief_complaint || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.vet || c.staff || "Clinic Staff"}</TableCell>
                </TableRow>
              ))}
              {careRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
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
