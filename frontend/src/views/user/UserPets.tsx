"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Printer } from "lucide-react";
import { useMyOwner, useMyPets, useMyVaccinations, useMyCareRecords } from "@/hooks/useOwnerData";
import { formatAge } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";

export default function UserPets() {
  const { data: owner } = useMyOwner();
  const { data: pets = [] } = useMyPets();
  const { data: vaccinations = [] } = useMyVaccinations();
  const { data: careRecords = [] } = useMyCareRecords();
  const [viewPet, setViewPet] = useState<any | null>(null);

  const vaccinesByPet = (petId: string) => vaccinations.filter((v: any) => v.pet_id === petId);
  const checkupsByPet = (petId: string) => careRecords.filter((c: any) => c.pet_id === petId && c.record_type !== "treatment");
  const treatmentsByPet = (petId: string) => careRecords.filter((c: any) => c.pet_id === petId && c.record_type === "treatment");

  const handlePrint = (pet: any) => {
    const vaccs = vaccinesByPet(pet.id);
    const checkups = checkupsByPet(pet.id);
    const treatments = treatmentsByPet(pet.id);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Pet Profile - ${pet.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a}
      h1{color:#1B3A5C;margin-bottom:4px}h3{margin-top:24px;color:#1B3A5C}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#E8EEF4;color:#1B3A5C}
      .header{border-bottom:2px solid #1B3A5C;padding-bottom:12px;margin-bottom:20px}</style></head>
      <body><div class="header"><h1>Harbourside Veterinary Clinic</h1><p>Pet Profile Report</p></div>
      <h2 style="margin:0 0 8px">${pet.name}</h2>
      <p><strong>Species:</strong> ${pet.species} | <strong>Breed:</strong> ${pet.breed ?? "—"} |
      <strong>Gender:</strong> ${pet.gender ?? "—"} | <strong>Age:</strong> ${formatAge(pet.dob)}</p>
      <p><strong>Owner:</strong> ${owner?.name ?? "—"} | <strong>Contact:</strong> ${owner?.contact ?? "—"}</p>
      <h3>Vaccination Records</h3>
      <table><tr><th>Vaccine</th><th>Date Given</th><th>Next Due</th><th>Notes</th></tr>
      ${vaccs.map((v: any) => `<tr><td>${v.vaccine_type}</td><td>${v.date_given ?? ""}</td><td>${v.next_due ?? ""}</td><td>${v.notes ?? ""}</td></tr>`).join("")}
      </table>
      <h3>Check-up History</h3>
      <table><tr><th>Date</th><th>Vet</th><th>Diagnosis</th></tr>
      ${checkups.map((c: any) => `<tr><td>${c.date ?? ""}</td><td>${c.vet ?? ""}</td><td>${c.diagnosis ?? ""}</td></tr>`).join("")}
      </table>
      <h3>Treatment History</h3>
      <table><tr><th>Treatment</th><th>Date</th><th>Notes</th></tr>
      ${treatments.map((t: any) => `<tr><td>${t.treatment ?? ""}</td><td>${t.date ?? ""}</td><td>${t.notes ?? ""}</td></tr>`).join("")}
      </table>
      <br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-heading text-2xl font-bold">My Pets</h2>
        <p className="text-muted-foreground text-sm">View your pets' details and history</p>
      </div>
      {pets.length === 0 && <p className="text-sm text-muted-foreground">No pets registered yet. Contact the clinic to add your pets.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pets.map((pet: any) => (
          <Card key={pet.id} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={pet.image_url} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">{pet.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-heading font-semibold">{pet.name} {pet.status === "deceased" && <Badge variant="secondary" className="ml-1">Deceased</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{pet.species} · {pet.breed} · {pet.gender}</p>
                    <p className="text-xs text-muted-foreground">Age: {formatAge(pet.dob)}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setViewPet(pet)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handlePrint(pet)}><Printer className="h-4 w-4" /></Button>
                </div>
              </div>
              <Tabs defaultValue="vaccines" className="mt-2">
                <TabsList className="h-8">
                  <TabsTrigger value="vaccines" className="text-xs">Vaccines</TabsTrigger>
                  <TabsTrigger value="checkups" className="text-xs">Check-ups</TabsTrigger>
                  <TabsTrigger value="treatments" className="text-xs">Treatments</TabsTrigger>
                </TabsList>
                <TabsContent value="vaccines" className="mt-2">
                  {vaccinesByPet(pet.id).map((v: any) => (
                    <div key={v.id} className="text-xs flex justify-between py-1 border-b last:border-0">
                      <span>{v.vaccine_type}</span><span className="text-muted-foreground">{v.next_due}</span>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="checkups" className="mt-2">
                  {checkupsByPet(pet.id).map((c: any) => (
                    <div key={c.id} className="text-xs py-1 border-b last:border-0">
                      <span className="font-medium">{c.date}</span> — {c.diagnosis}
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="treatments" className="mt-2">
                  {treatmentsByPet(pet.id).map((t: any) => (
                    <div key={t.id} className="text-xs py-1 border-b last:border-0">
                      <span className="font-medium">{t.treatment}</span> — {t.notes}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!viewPet} onOpenChange={(open) => !open && setViewPet(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Pet Profile</DialogTitle>
          </DialogHeader>
          {viewPet && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={viewPet.image_url} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{viewPet.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-heading text-lg font-bold">{viewPet.name}</h3>
                  <p className="text-sm text-muted-foreground">{viewPet.species} · {viewPet.breed} · {viewPet.gender}</p>
                  <p className="text-sm text-muted-foreground">Age: {formatAge(viewPet.dob)}</p>
                  <p className="text-sm text-muted-foreground">Owner: {owner?.name}</p>
                </div>
              </div>
              <Tabs defaultValue="vaccines">
                <TabsList className="w-full">
                  <TabsTrigger value="vaccines" className="flex-1 text-xs">Vaccines</TabsTrigger>
                  <TabsTrigger value="checkups" className="flex-1 text-xs">Check-ups</TabsTrigger>
                  <TabsTrigger value="treatments" className="flex-1 text-xs">Treatments</TabsTrigger>
                </TabsList>
                <TabsContent value="vaccines" className="mt-3 space-y-1">
                  {vaccinesByPet(viewPet.id).length === 0 && <p className="text-sm text-muted-foreground">No records</p>}
                  {vaccinesByPet(viewPet.id).map((v: any) => (
                    <div key={v.id} className="flex justify-between items-center text-sm py-2 border-b last:border-0">
                      <div><p className="font-medium">{v.vaccine_type}</p><p className="text-xs text-muted-foreground">Given: {v.date_given}</p></div>
                      <div className="text-right"><p className="text-xs text-muted-foreground">Next due</p><p className="text-sm font-medium">{v.next_due}</p></div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="checkups" className="mt-3 space-y-1">
                  {checkupsByPet(viewPet.id).length === 0 && <p className="text-sm text-muted-foreground">No records</p>}
                  {checkupsByPet(viewPet.id).map((c: any) => (
                    <div key={c.id} className="text-sm py-2 border-b last:border-0">
                      <div className="flex justify-between"><span className="font-medium">{c.date}</span><span className="text-muted-foreground">{c.vet}</span></div>
                      <p className="text-xs text-muted-foreground mt-1">{c.diagnosis}</p>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="treatments" className="mt-3 space-y-1">
                  {treatmentsByPet(viewPet.id).length === 0 && <p className="text-sm text-muted-foreground">No records</p>}
                  {treatmentsByPet(viewPet.id).map((t: any) => (
                    <div key={t.id} className="text-sm py-2 border-b last:border-0">
                      <div className="flex justify-between"><span className="font-medium">{t.treatment}</span><span className="text-muted-foreground">{t.date}</span></div>
                      <p className="text-xs text-muted-foreground mt-1">{t.notes}</p>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => handlePrint(viewPet)}>
                  <Printer className="h-3 w-3 mr-1" /> Print Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

