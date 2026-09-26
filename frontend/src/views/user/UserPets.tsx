"use client";

import { printDocument } from "@/lib/print";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Eye, PawPrint, Printer } from "lucide-react";
import { useMyOwner, useMyPets, useMyVaccinations, useMyCareRecords, useMyAppointments, useMyDewormings } from "@/hooks/useOwnerData";
import { formatAge, formatDate } from "@/lib/age";
import { daysFromTodayPH, formatNowPH } from "@/lib/datetime";
import PetCareHistoryTimeline from "@/components/PetCareHistoryTimeline";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { getStatusBadgeClass, formatTimeSlot } from "@/lib/appointment-slots";

export default function UserPets() {
  const { data: owner } = useMyOwner();
  const { data: pets = [] } = useMyPets();
  const { data: vaccinations = [] } = useMyVaccinations();
  const { data: dewormings = [] } = useMyDewormings();
  const { data: careRecords = [] } = useMyCareRecords();
  const { data: appointments = [] } = useMyAppointments();
  const [viewPet, setViewPet] = useState<any | null>(null);

  const upcomingForPet = (petId: string) =>
    appointments
      .filter(
        (a: any) =>
          a.pet_id === petId &&
          a.status !== "Cancelled" &&
          a.status !== "Completed" &&
          a.status !== "Missed" &&
          (daysFromTodayPH(a.date) ?? -1) >= 0,
      )
      .sort((a: any, b: any) => String(a.date).localeCompare(String(a.date)))[0];

  const vaccinesByPet = (petId: string) => {
    const fromVax = vaccinations.filter((v: any) => v.pet_id === petId);
    const fromCare = careRecords
      .filter(
        (c: any) =>
          c.pet_id === petId &&
          (String(c.record_type || "").toLowerCase() === "vaccination" ||
            String(c.record_type || "").toLowerCase() === "vaccine" ||
            !!c.vaccine_used)
      )
      .map((c: any) => ({
        id: c.id,
        pet_id: c.pet_id,
        vaccine_type: c.vaccine_used || c.diagnosis || "Vaccination",
        date_given: c.date,
        next_due: c.next_vax_due,
        vet: c.vet || "Clinic Staff",
        notes: c.notes,
      }));
    const map = new Map();
    fromVax.forEach((v: any) => map.set(`${v.date_given || v.created_at}_${v.vaccine_type}`, v));
    fromCare.forEach((v: any) => {
      const key = `${v.date_given}_${v.vaccine_type}`;
      if (!map.has(key)) map.set(key, v);
    });
    return Array.from(map.values()).sort((a: any, b: any) => String(b.date_given || "").localeCompare(String(a.date_given || "")));
  };

  const dewormingsByPet = (petId: string) => {
    const fromDeworm = dewormings.filter((d: any) => d.pet_id === petId);
    const fromCare = careRecords
      .filter(
        (c: any) =>
          c.pet_id === petId &&
          (String(c.record_type || "").toLowerCase() === "deworming" || !!c.dewormer_used)
      )
      .map((c: any) => ({
        id: c.id,
        pet_id: c.pet_id,
        product: c.dewormer_used || c.diagnosis || "Deworming",
        dewormer_used: c.dewormer_used || c.diagnosis || "Deworming",
        date_given: c.date,
        date: c.date,
        next_due: c.next_deworming_due,
        next_deworming_due: c.next_deworming_due,
        status: c.outcome || "Completed",
        vet: c.vet || "Clinic Staff",
        notes: c.notes,
      }));
    const map = new Map();
    fromDeworm.forEach((d: any) => map.set(`${d.date_given || d.date || d.created_at}_${d.product || d.dewormer_used}`, d));
    fromCare.forEach((d: any) => {
      const key = `${d.date_given}_${d.product}`;
      if (!map.has(key)) map.set(key, d);
    });
    return Array.from(map.values()).sort((a: any, b: any) => String(b.date_given || b.date || "").localeCompare(String(a.date_given || a.date || "")));
  };

  const checkupsByPet = (petId: string) =>
    careRecords.filter(
      (c: any) =>
        c.pet_id === petId &&
        (String(c.record_type || "").toLowerCase() === "checkup" ||
          String(c.record_type || "").toLowerCase() === "check-up" ||
          (!c.record_type && !c.vaccine_used && !c.dewormer_used))
    );

  const treatmentsByPet = (petId: string) =>
    careRecords.filter(
      (c: any) =>
        c.pet_id === petId &&
        (String(c.record_type || "").toLowerCase() === "treatment" || !!c.treatment)
    );

  const handlePrint = (pet: any) => {
    const vaccs = vaccinesByPet(pet.id);
    const checkups = checkupsByPet(pet.id);
    const treatments = treatmentsByPet(pet.id);
    const dewormingsList = dewormingsByPet(pet.id);
    const petRecords = careRecords.filter((c: any) => c.pet_id === pet.id).sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));

    const bodyHtml = `
      <div class="header-brand">
        <img src="/logo.png" style="height:44px;width:44px;object-fit:contain;border-radius:6px;" alt="HVS" />
        <div>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Official Pet Medical Record & Care History</h2>
        </div>
      </div>
      
      <h3 style="margin:4px 0 12px;color:#333;font-size:16px">${pet.name}</h3>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:16px">
        <div><strong>Species & Breed:</strong> ${pet.species} (${pet.breed ?? "Crossbreed"})</div>
        <div><strong>Owner Name:</strong> ${owner?.name ?? "—"}</div>
        <div><strong>Gender & Age:</strong> ${pet.gender ?? "—"} | ${formatAge(pet.dob)}</div>
        <div><strong>Owner Contact:</strong> ${owner?.contact ?? "—"}</div>
      </div>

      <h3 style="color:#1B3A5C;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px">Care History Medical Timeline (${petRecords.length})</h3>
      ${
        petRecords.length
          ? petRecords.map((r: any) => `
            <div style="border:1px solid #e2e8f0;border-left:4px solid #7F1D1D;padding:10px;margin-bottom:10px;border-radius:4px;background:#fff">
              <div style="font-weight:bold;color:#475569;font-size:11px">Date: ${r.date ? formatDate(r.date) : "—"} | Type: ${r.record_type || "Visit"}</div>
              <div style="font-size:12px;font-weight:bold;color:#7F1D1D;margin:2px 0">${r.diagnosis || r.vaccine_used || r.treatment || r.dewormer_used || r.chief_complaint || "Medical Service"}</div>
              ${r.vet ? `<div style="font-size:11px;color:#334155;margin-top:2px"><strong>Vet/Staff:</strong> ${r.vet}</div>` : ""}
              ${r.chief_complaint ? `<div style="font-size:11px;color:#334155;margin-top:2px"><strong>Reason:</strong> ${r.chief_complaint}</div>` : ""}
              ${r.diagnosis ? `<div style="font-size:11px;color:#334155;margin-top:2px"><strong>Diagnosis:</strong> ${r.diagnosis}</div>` : ""}
              ${r.treatment ? `<div style="font-size:11px;color:#334155;margin-top:2px"><strong>Treatment:</strong> ${r.treatment}</div>` : ""}
              ${r.medication ? `<div style="font-size:11px;color:#334155;margin-top:2px"><strong>Medications:</strong> ${r.medication}</div>` : ""}
              ${r.notes ? `<div style="font-size:11px;color:#334155;margin-top:2px"><strong>Notes:</strong> ${r.notes}</div>` : ""}
            </div>
          `).join("")
          : "<p style='font-size:12px;color:#888'>No medical care history records logged.</p>"
      }

      <h3 style="color:#1B3A5C;margin-top:20px">Check-up Records</h3>
      <table><tr><th>Date</th><th>Vet</th><th>Diagnosis</th><th>Treatment</th></tr>
      ${checkups.map((c: any) => `<tr><td>${c.date ? formatDate(c.date) : "—"}</td><td>${c.vet ?? "—"}</td><td>${c.diagnosis ?? "—"}</td><td>${c.treatment ?? "—"}</td></tr>`).join("") || "<tr><td colSpan='4'>No records</td></tr>"}
      </table>

      <h3 style="color:#1B3A5C;margin-top:20px">Vaccination Records</h3>
      <table><tr><th>Vaccine</th><th>Date Given</th><th>Next Due</th><th>Notes</th></tr>
      ${vaccs.map((v: any) => `<tr><td>${v.vaccine_type}</td><td>${v.date_given ? formatDate(v.date_given) : "—"}</td><td>${v.next_due ? formatDate(v.next_due) : "—"}</td><td>${v.notes ?? "—"}</td></tr>`).join("") || "<tr><td colSpan='4'>No records</td></tr>"}
      </table>

      <h3 style="color:#1B3A5C;margin-top:20px">Treatment History</h3>
      <table><tr><th>Treatment</th><th>Date</th><th>Diagnosis</th><th>Notes</th></tr>
      ${treatments.map((t: any) => `<tr><td>${t.treatment ?? "—"}</td><td>${t.date ? formatDate(t.date) : "—"}</td><td>${t.diagnosis ?? "—"}</td><td>${t.notes ?? "—"}</td></tr>`).join("") || "<tr><td colSpan='4'>No records</td></tr>"}
      </table>

      <h3 style="color:#1B3A5C;margin-top:20px">Deworming Records</h3>
      <table><tr><th>Product / Treatment</th><th>Date Given</th><th>Next Due</th><th>Notes</th></tr>
      ${dewormingsList.map((d: any) => `<tr><td>${d.dewormer_used || d.product || "Deworming"}</td><td>${d.date ? formatDate(d.date) : d.date_given ? formatDate(d.date_given) : "—"}</td><td>${d.next_deworming_due ? formatDate(d.next_deworming_due) : d.next_due ? formatDate(d.next_due) : "—"}</td><td>${d.notes ?? "—"}</td></tr>`).join("") || "<tr><td colSpan='4'>No records</td></tr>"}
      </table>

      <div class="footer-brand">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic</div>
    `;

    printDocument({
      title: `Pet Medical Record - ${pet.name}`,
      bodyHtml,
    });
  };

  return (
    <div className="page-container space-y-6 pb-10">
      <PageHeader
        title="My Pets"
        description="Manage your pets' profiles, check upcoming clinic visits, and review full care history"
      />
      {pets.length === 0 && (
        <EmptyState
          icon={PawPrint}
          title="No pets registered yet"
          description="Contact the clinic to add your pets to this account."
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {pets.map((pet: any) => {
          const upcoming = upcomingForPet(pet.id);
          return (
            <Card key={pet.id} className="group border border-border/80 shadow-sm hover:shadow-md hover:border-[#E5192C]/40 transition-all rounded-2xl overflow-hidden bg-card">
              <div className="h-2 bg-gradient-to-r from-[#7F1D1D] to-[#E5192C]" />
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar className="h-16 w-16 rounded-xl border-2 border-[#E5192C]/30 shadow-sm group-hover:scale-105 transition-transform">
                      <AvatarImage src={pet.image_url} className="object-cover" />
                      <AvatarFallback className="rounded-xl bg-[#FEE2E2] text-[#7F1D1D] font-bold text-xl">
                        {pet.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-heading font-bold text-[#7F1D1D] text-lg truncate">
                          {pet.name}
                        </h3>
                        {pet.status === "deceased" && (
                          <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[10px]">Deceased</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pet.species} · {pet.breed || "Crossbreed"} · {pet.gender || "—"}
                      </p>
                      <p className="text-xs font-medium text-[#E5192C] mt-0.5">Age: {pet.dob ? formatAge(pet.dob) : "Not specified"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#7F1D1D] hover:bg-[#FEE2E2]" onClick={() => setViewPet(pet)} title="View profile">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#7F1D1D] hover:bg-[#FEE2E2]" onClick={() => handlePrint(pet)} title="Print Medical Record">
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {upcoming ? (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#E5192C]/30 bg-[#FFF1F2]/80 p-3 shadow-xs">
                    <Calendar className="h-4 w-4 text-[#E5192C] mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#7F1D1D]">
                          Upcoming Visit
                        </p>
                        <Badge variant="outline" className={`${getStatusBadgeClass(upcoming.status)} text-[10px] py-0`}>
                          {upcoming.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-[#7F1D1D] mt-0.5">
                        {formatDate(upcoming.date)} {upcoming.time ? `at ${formatTimeSlot(upcoming.time)}` : ""}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-muted-foreground flex items-center justify-between">
                    <span>No upcoming appointment</span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs text-[#E5192C] font-semibold" asChild>
                      <a href="/user/appointments">+ Book Visit</a>
                    </Button>
                  </div>
                )}

                <Button size="sm" className="w-full mb-3 bg-[#7F1D1D] hover:bg-[#5C1315] text-white font-semibold text-xs shadow-xs" onClick={() => setViewPet(pet)}>
                  View Full Profile & Care History
                </Button>

                <Tabs defaultValue="checkups" className="mt-2">
                  <TabsList className="h-8 w-full bg-muted/60 p-0.5 grid grid-cols-4">
                    <TabsTrigger value="checkups" className="text-[10px] sm:text-xs py-1 data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D] data-[state=active]:font-bold">Check-ups</TabsTrigger>
                    <TabsTrigger value="vaccines" className="text-[10px] sm:text-xs py-1 data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D] data-[state=active]:font-bold">Vaccines</TabsTrigger>
                    <TabsTrigger value="treatments" className="text-[10px] sm:text-xs py-1 data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D] data-[state=active]:font-bold">Treatments</TabsTrigger>
                    <TabsTrigger value="dewormings" className="text-[10px] sm:text-xs py-1 data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D] data-[state=active]:font-bold">Dewormings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="checkups" className="mt-2.5 space-y-1">
                    {checkupsByPet(pet.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No check-up history</p>
                    ) : (
                      checkupsByPet(pet.id).slice(0, 3).map((c: any) => (
                        <div key={c.id} className="text-xs py-1.5 border-b last:border-0">
                          <span className="font-semibold text-[#1B3A5C]">{c.date ? formatDate(c.date) : "—"}</span> — {c.diagnosis || "Regular Visit"}
                        </div>
                      ))
                    )}
                  </TabsContent>
                  <TabsContent value="vaccines" className="mt-2.5 space-y-1">
                    {vaccinesByPet(pet.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No vaccination history</p>
                    ) : (
                      vaccinesByPet(pet.id).slice(0, 3).map((v: any) => (
                        <div key={v.id} className="text-xs flex justify-between py-1.5 border-b last:border-0">
                          <span className="font-semibold text-[#1B3A5C]">{v.vaccine_type}</span>
                          <span className="text-muted-foreground text-[11px]">Due: {v.next_due ? formatDate(v.next_due) : "—"}</span>
                        </div>
                      ))
                    )}
                  </TabsContent>
                  <TabsContent value="treatments" className="mt-2.5 space-y-1">
                    {treatmentsByPet(pet.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No treatment history</p>
                    ) : (
                      treatmentsByPet(pet.id).slice(0, 3).map((t: any) => (
                        <div key={t.id} className="text-xs py-1.5 border-b last:border-0">
                          <span className="font-semibold text-[#1B3A5C]">{t.treatment || "Treatment"}</span> — {t.notes || "Completed"}
                        </div>
                      ))
                    )}
                  </TabsContent>
                  <TabsContent value="dewormings" className="mt-2.5 space-y-1">
                    {dewormingsByPet(pet.id).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No deworming history</p>
                    ) : (
                      dewormingsByPet(pet.id).slice(0, 3).map((d: any) => (
                        <div key={d.id} className="text-xs flex justify-between py-1.5 border-b last:border-0">
                          <span className="font-semibold text-amber-900">{d.dewormer_used || d.product || "Deworming"}</span>
                          <span className="text-muted-foreground text-[11px]">Due: {d.next_deworming_due ? formatDate(d.next_deworming_due) : d.next_due ? formatDate(d.next_due) : "—"}</span>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pet Profile Detail Dialog */}
      <Dialog open={!!viewPet} onOpenChange={(open) => !open && setViewPet(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="font-heading text-lg font-bold text-[#7F1D1D] flex items-center gap-2">
              <PawPrint className="h-5 w-5 text-[#E5192C]" /> Pet Profile & Medical Records
            </DialogTitle>
          </DialogHeader>
          {viewPet && (
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#FEE2E2] to-[#FFF1F2] border border-[#E5192C]/20">
                <Avatar className="h-20 w-20 border-2 border-white shadow-md">
                  <AvatarImage src={viewPet.image_url} />
                  <AvatarFallback className="bg-[#7F1D1D] text-white text-2xl font-bold">
                    {viewPet.name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="font-heading text-xl font-extrabold text-[#7F1D1D]">{viewPet.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {viewPet.species} · {viewPet.breed || "Crossbreed"} · {viewPet.gender || "—"}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 pt-1">
                    <span><strong>Age:</strong> {formatAge(viewPet.dob)}</span>
                    {viewPet.weight && <span><strong>Weight:</strong> {viewPet.weight}</span>}
                    <span><strong>Owner:</strong> {owner?.name}</span>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="w-full bg-muted p-1 grid grid-cols-5">
                  <TabsTrigger value="timeline" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D]">Care History</TabsTrigger>
                  <TabsTrigger value="checkups" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D]">Check-ups</TabsTrigger>
                  <TabsTrigger value="vaccines" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D]">Vaccines</TabsTrigger>
                  <TabsTrigger value="treatments" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D]">Treatments</TabsTrigger>
                  <TabsTrigger value="dewormings" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#7F1D1D]">Dewormings</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline" className="mt-3">
                  <PetCareHistoryTimeline petId={viewPet.id} />
                </TabsContent>
                <TabsContent value="checkups" className="mt-3 space-y-2">
                  {checkupsByPet(viewPet.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No check-up records</p>
                  )}
                  {checkupsByPet(viewPet.id).map((c: any) => (
                    <div key={c.id} className="text-sm p-3 rounded-lg border bg-card space-y-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-[#1B3A5C]">{c.date ? formatDate(c.date) : "—"}</span>
                        <span className="text-xs text-muted-foreground">{c.vet || "Clinic Vet"}</span>
                      </div>
                      <p className="text-xs text-slate-700"><strong>Diagnosis:</strong> {c.diagnosis || "General Exam"}</p>
                      {c.treatment && <p className="text-xs text-slate-700"><strong>Treatment:</strong> {c.treatment}</p>}
                      {c.medication && <p className="text-xs text-slate-700"><strong>Medications:</strong> {c.medication}</p>}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="vaccines" className="mt-3 space-y-2">
                  {vaccinesByPet(viewPet.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No vaccination records</p>
                  )}
                  {vaccinesByPet(viewPet.id).map((v: any) => (
                    <div key={v.id} className="flex justify-between items-center text-sm p-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-bold text-[#1B3A5C]">{v.vaccine_type}</p>
                        <p className="text-xs text-muted-foreground">Given: {v.date_given ? formatDate(v.date_given) : "—"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Next due</p>
                        <p className="text-xs font-bold text-[#1FA8A8]">{v.next_due ? formatDate(v.next_due) : "—"}</p>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="treatments" className="mt-3 space-y-2">
                  {treatmentsByPet(viewPet.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No treatment records</p>
                  )}
                  {treatmentsByPet(viewPet.id).map((t: any) => (
                    <div key={t.id} className="text-sm p-3 rounded-lg border bg-card space-y-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-[#1B3A5C]">{t.treatment || "Treatment Procedure"}</span>
                        <span className="text-xs text-muted-foreground">{t.date ? formatDate(t.date) : "—"}</span>
                      </div>
                      <p className="text-xs text-slate-700">{t.notes || "No notes provided"}</p>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="dewormings" className="mt-3 space-y-2">
                  {dewormingsByPet(viewPet.id).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">No deworming records</p>
                  )}
                  {dewormingsByPet(viewPet.id).map((d: any) => (
                    <div key={d.id} className="text-sm p-3 rounded-lg border bg-card space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-amber-900">{d.dewormer_used || d.product || "Deworming Procedure"}</span>
                        <span className="text-xs text-muted-foreground">{d.date ? formatDate(d.date) : d.date_given ? formatDate(d.date_given) : "—"}</span>
                      </div>
                      {d.next_deworming_due || d.next_due ? (
                        <p className="text-xs text-amber-800 font-medium">Next due: {formatDate(d.next_deworming_due || d.next_due)}</p>
                      ) : null}
                      <p className="text-xs text-slate-700">{d.notes || "No notes provided"}</p>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
              <div className="flex justify-end pt-2 border-t">
                <Button variant="outline" size="sm" className="border-[#1B3A5C] text-[#1B3A5C] hover:bg-[#E8EEF4]" onClick={() => handlePrint(viewPet)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Official Medical Record
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
