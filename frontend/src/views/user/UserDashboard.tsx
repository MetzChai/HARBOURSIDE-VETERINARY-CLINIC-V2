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
import { getStatusBadgeClass } from "@/lib/appointment-slots";
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
    <div className="page-container pb-10">
      <PageHeader
        title={`Welcome back, ${owner?.name ?? "Pet Owner"}`}
        description="Your pets, upcoming visits, and recent care records"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href="/user/appointments">
                <PlusCircle className="h-4 w-4" /> Request Appointment
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/user/care-history">
                <FileText className="h-4 w-4" /> View Care History
              </Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const chatBtn = document.querySelector('[data-chat-toggle="true"]') as HTMLButtonElement;
                if (chatBtn) chatBtn.click();
              }}
            >
              <Sparkles className="h-4 w-4" /> Open PawBot
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="My Pets" value={pets.length} icon={PawPrint} variant="default" />
        <StatCard title="Upcoming Appointments" value={upcomingAppointments.length} icon={Calendar} variant="info" />
        <StatCard title="Requested Appointments" value={requestedAppointments.length} icon={Clock} variant="warning" />
        <StatCard title="Recent Care Records" value={careRecords.length} icon={FileText} variant="success" />
        <StatCard title="Vaccines Due" value={vaccinesDue.length} icon={Syringe} variant="warning" />
        <StatCard title="Deworming Due" value={dewormingsDue.length} icon={HeartPulse} variant="success" />
      </div>

      {/* My Pets Grid */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-brand-teal" /> My Pets
          </CardTitle>
          <Link href="/user/pets">
            <Button variant="ghost" size="sm" className="text-xs">
              View All Pets →
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pets.length === 0 && (
            <EmptyState
              icon={PawPrint}
              title="No pets registered yet"
              description="Please contact the clinic staff to register your pets."
            />
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pets.map((pet: any) => (
              <Card key={pet.id} className="hover:border-brand-teal/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-brand-navy-light flex items-center justify-center font-heading font-bold text-brand-navy overflow-hidden">
                        {pet.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pet.image_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          pet.name[0]
                        )}
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
                  <Button size="sm" variant="outline" className="w-full" asChild>
                    <Link href="/user/pets">View Profile</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Appointments Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-teal" /> Upcoming Appointments
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
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-teal" /> Recent Care Records
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
