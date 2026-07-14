"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PawPrint, Calendar, Syringe, Printer } from "lucide-react";
import { useMyOwner, useMyPets, useMyAppointments, useMyVaccinations } from "@/hooks/useOwnerData";
import { formatAge } from "@/lib/age";
import { isWithinDaysFromTodayPH } from "@/lib/datetime";

export default function UserDashboard() {
  const { data: owner } = useMyOwner();
  const { data: pets = [] } = useMyPets();
  const { data: appointments = [] } = useMyAppointments();
  const { data: vaccinations = [] } = useMyVaccinations();

  const vaccinesDue = vaccinations.filter((v: any) => v.next_due && isWithinDaysFromTodayPH(v.next_due, 30));
  const upcoming = appointments.filter((a: any) => a.status === "scheduled" || a.status === "Scheduled");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl font-bold">Welcome, {owner?.name ?? "Pet Owner"}</h2>
        <p className="text-muted-foreground text-sm">Manage your pets and appointments</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <PawPrint className="h-6 w-6 text-primary" />
            </div>
            <div><p className="text-2xl font-bold font-heading">{pets.length}</p><p className="text-xs text-muted-foreground">My Pets</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-amber-500" />
            </div>
            <div><p className="text-2xl font-bold font-heading">{upcoming.length}</p><p className="text-xs text-muted-foreground">Upcoming</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Syringe className="h-6 w-6 text-destructive" />
            </div>
            <div><p className="text-2xl font-bold font-heading">{vaccinesDue.length}</p><p className="text-xs text-muted-foreground">Vaccines Due</p></div>
          </CardContent>
        </Card>
      </div>

      {vaccinesDue.length > 0 && (
        <Card className="border-warning/20 bg-warning/5 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-2">🔔 Reminders</p>
            {vaccinesDue.map((v: any) => (
              <p key={v.id} className="text-sm text-muted-foreground">
                {v.pets?.name}'s <strong>{v.vaccine_type}</strong> vaccine is due on {v.next_due}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="font-heading text-base">My Pets</CardTitle></CardHeader>
        <CardContent>
          {pets.length === 0 && <p className="text-sm text-muted-foreground">No pets registered yet. Contact the clinic to add your pets.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pets.map((pet: any) => (
              <Card key={pet.id} className="shadow-none border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <PawPrint className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold">{pet.name} {pet.status === "deceased" && <Badge variant="secondary" className="ml-1">Deceased</Badge>}</p>
                      <p className="text-xs text-muted-foreground">{pet.species} · {pet.breed} · {pet.gender}</p>
                      {pet.dob && <p className="text-xs text-muted-foreground">{formatAge(pet.dob)}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base">My Schedule</CardTitle>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-3 w-3 mr-1" /> Print</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Pet</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {appointments.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No appointments yet.</TableCell></TableRow>
              )}
              {appointments.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.pets?.name}</TableCell>
                  <TableCell>{a.date}</TableCell>
                  <TableCell>{a.time}</TableCell>
                  <TableCell><Badge variant={a.status === "completed" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

