"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Printer, Loader2, Plus, Pencil } from "lucide-react";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";
import { db } from "@/lib/db-client";
import { VET_OPTIONS } from "@/lib/appointment-slots";
import { toast } from "sonner";

function toInputDate(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function CareHistory() {
  const { data: pets = [], isLoading: petsLoading } = useRows<any>("pets", { orderBy: "name" });
  const { data: careRecords = [] } = useRows<any>("care_records", { orderBy: "date", ascending: false });
  const { data: vaccinations = [] } = useRows<any>("vaccinations", { orderBy: "date_given", ascending: false });
  const invalidate = useInvalidate();

  const [selectedPet, setSelectedPet] = useState("");
  const [activeTab, setActiveTab] = useState("checkups");
  const [saving, setSaving] = useState(false);
  const [showCheckup, setShowCheckup] = useState(false);
  const [showTreatment, setShowTreatment] = useState(false);
  const [showVaccine, setShowVaccine] = useState(false);
  const [editingCheckupId, setEditingCheckupId] = useState<string | null>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);
  const [editingVaccineId, setEditingVaccineId] = useState<string | null>(null);

  const [checkupForm, setCheckupForm] = useState({
    date: "",
    vet: "",
    diagnosis: "",
    outcome: "",
    notes: "",
  });

  const [treatmentForm, setTreatmentForm] = useState({
    date: "",
    vet: "",
    treatment: "",
    medication: "",
    dosage: "",
    notes: "",
  });

  const [vaccineForm, setVaccineForm] = useState({
    vaccine_type: "",
    date_given: "",
    next_due: "",
    vet: "",
    notes: "",
  });

  const activePet = selectedPet || pets[0]?.id || "";
  const pet = pets.find((p) => p.id === activePet);

  const checkups = careRecords.filter(
    (r) => r.pet_id === activePet && (r.record_type === "checkup" || !r.record_type)
  );
  const treatments = careRecords.filter(
    (r) => r.pet_id === activePet && r.record_type === "treatment"
  );
  const petVaccinations = vaccinations.filter((v) => v.pet_id === activePet);

  const resetCheckupForm = () =>
    setCheckupForm({ date: "", vet: "", diagnosis: "", outcome: "", notes: "" });
  const resetTreatmentForm = () =>
    setTreatmentForm({ date: "", vet: "", treatment: "", medication: "", dosage: "", notes: "" });
  const resetVaccineForm = () =>
    setVaccineForm({ vaccine_type: "", date_given: "", next_due: "", vet: "", notes: "" });

  const openAddCheckup = () => {
    setEditingCheckupId(null);
    resetCheckupForm();
    setShowCheckup(true);
  };

  const openEditCheckup = (record: any) => {
    setEditingCheckupId(record.id);
    setCheckupForm({
      date: toInputDate(record.date),
      vet: record.vet ?? "",
      diagnosis: record.diagnosis ?? "",
      outcome: record.outcome ?? "",
      notes: record.notes ?? "",
    });
    setShowCheckup(true);
  };

  const openAddTreatment = () => {
    setEditingTreatmentId(null);
    resetTreatmentForm();
    setShowTreatment(true);
  };

  const openEditTreatment = (record: any) => {
    setEditingTreatmentId(record.id);
    setTreatmentForm({
      date: toInputDate(record.date),
      vet: record.vet ?? "",
      treatment: record.treatment ?? "",
      medication: record.medication ?? "",
      dosage: record.dosage ?? "",
      notes: record.notes ?? "",
    });
    setShowTreatment(true);
  };

  const openAddVaccine = () => {
    setEditingVaccineId(null);
    resetVaccineForm();
    setShowVaccine(true);
  };

  const openEditVaccine = (record: any) => {
    setEditingVaccineId(record.id);
    setVaccineForm({
      vaccine_type: record.vaccine_type ?? "",
      date_given: toInputDate(record.date_given),
      next_due: toInputDate(record.next_due),
      vet: record.vet ?? "",
      notes: record.notes ?? "",
    });
    setShowVaccine(true);
  };

  const saveCheckup = async () => {
    if (!activePet || !checkupForm.date || !checkupForm.vet.trim()) {
      toast.error("Date and vet are required");
      return;
    }
    setSaving(true);
    const payload = {
      date: checkupForm.date,
      vet: checkupForm.vet,
      diagnosis: checkupForm.diagnosis.trim() || null,
      outcome: checkupForm.outcome.trim() || null,
      notes: checkupForm.notes.trim() || null,
    };

    const { error } = editingCheckupId
      ? await db.from("care_records").update(payload as any).eq("id", editingCheckupId)
      : await db.from("care_records").insert({
          pet_id: activePet,
          record_type: "checkup",
          ...payload,
        } as any);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingCheckupId ? "Check-up updated" : "Check-up recorded");
    setShowCheckup(false);
    setEditingCheckupId(null);
    resetCheckupForm();
    invalidate("care_records");
  };

  const saveTreatment = async () => {
    if (!activePet || !treatmentForm.date || !treatmentForm.vet.trim() || !treatmentForm.treatment.trim()) {
      toast.error("Date, vet, and treatment are required");
      return;
    }
    setSaving(true);
    const payload = {
      date: treatmentForm.date,
      vet: treatmentForm.vet,
      treatment: treatmentForm.treatment.trim(),
      medication: treatmentForm.medication.trim() || null,
      dosage: treatmentForm.dosage.trim() || null,
      notes: treatmentForm.notes.trim() || null,
    };

    const { error } = editingTreatmentId
      ? await db.from("care_records").update(payload as any).eq("id", editingTreatmentId)
      : await db.from("care_records").insert({
          pet_id: activePet,
          record_type: "treatment",
          ...payload,
        } as any);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingTreatmentId ? "Treatment updated" : "Treatment recorded");
    setShowTreatment(false);
    setEditingTreatmentId(null);
    resetTreatmentForm();
    invalidate("care_records");
  };

  const saveVaccine = async () => {
    if (!activePet || !vaccineForm.vaccine_type.trim()) {
      toast.error("Vaccine type is required");
      return;
    }
    setSaving(true);
    const payload = {
      vaccine_type: vaccineForm.vaccine_type.trim(),
      date_given: vaccineForm.date_given || null,
      next_due: vaccineForm.next_due || null,
      vet: vaccineForm.vet || null,
      notes: vaccineForm.notes.trim() || null,
    };

    const { error } = editingVaccineId
      ? await db.from("vaccinations").update(payload as any).eq("id", editingVaccineId)
      : await db.from("vaccinations").insert({
          pet_id: activePet,
          ...payload,
        } as any);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingVaccineId ? "Vaccination updated" : "Vaccination recorded");
    setShowVaccine(false);
    setEditingVaccineId(null);
    resetVaccineForm();
    invalidate("vaccinations");
  };

  const printVaccineCertificate = (vax: any) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Vaccination Certificate</title>
      <style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#1B3A5C}
      .cert{border:3px solid #1B3A5C;padding:30px;margin-top:20px;border-radius:12px}
      .header{text-align:center;border-bottom:2px solid #1B3A5C;padding-bottom:12px}</style></head>
      <body><div class="cert"><div class="header"><h1>Harbourside Veterinary Clinic</h1>
      <h2>Vaccination Certificate</h2></div>
      <p><strong>Pet:</strong> ${pet?.name ?? "—"}</p>
      <p><strong>Vaccine:</strong> ${vax.vaccine_type}</p>
      <p><strong>Date Given:</strong> ${vax.date_given ? formatDate(vax.date_given) : "—"}</p>
      <p><strong>Next Due:</strong> ${vax.next_due ? formatDate(vax.next_due) : "—"}</p>
      <p><strong>Vet:</strong> ${vax.vet ?? "—"}</p>
      <p><strong>Notes:</strong> ${vax.notes || "N/A"}</p>
      <br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p>
      </div></body></html>
    `);
    w.document.close();
    w.print();
  };

  const handlePrint = (section?: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    let content = `<h1>Harbourside Veterinary Clinic</h1><h2>Care History: ${pet?.name || ""}</h2>`;

    if (!section || section === "checkups") {
      content += `<h3>Check-ups</h3><table><tr><th>Date</th><th>Vet</th><th>Diagnosis</th></tr>
      ${checkups.map((c) => `<tr><td>${c.date ? formatDate(c.date) : "—"}</td><td>${c.vet ?? "—"}</td><td>${c.diagnosis ?? "—"}</td></tr>`).join("")}</table>`;
    }
    if (!section || section === "vaccines") {
      content += `<h3>Vaccinations</h3><table><tr><th>Vaccine</th><th>Date</th><th>Next Due</th></tr>
      ${petVaccinations.map((v) => `<tr><td>${v.vaccine_type}</td><td>${v.date_given ? formatDate(v.date_given) : "—"}</td><td>${v.next_due ? formatDate(v.next_due) : "—"}</td></tr>`).join("")}</table>`;
    }
    if (!section || section === "treatments") {
      content += `<h3>Treatments</h3><table><tr><th>Treatment</th><th>Date</th><th>Notes</th></tr>
      ${treatments.map((t) => `<tr><td>${t.treatment ?? "—"}</td><td>${t.date ? formatDate(t.date) : "—"}</td><td>${t.notes ?? "—"}</td></tr>`).join("")}</table>`;
    }

    w.document.write(`<html><head><title>Care History - ${pet?.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#1B3A5C}
    table{width:100%;border-collapse:collapse;margin:16px 0}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#E8EEF4;color:#1B3A5C}</style></head>
    <body>${content}<br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p></body></html>`);
    w.document.close();
    w.print();
  };

  if (petsLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Pet Care History</h1>
          <p className="text-muted-foreground text-sm">Record and view medical history for registered pets</p>
        </div>
        <div className="flex gap-2">
          <Select value={activePet} onValueChange={setSelectedPet}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select pet" /></SelectTrigger>
            <SelectContent>
              {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handlePrint()} disabled={!activePet}>
            <Printer className="h-4 w-4 mr-1" /> Print All
          </Button>
        </div>
      </div>

      {!activePet ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-12 text-center text-muted-foreground">
            No registered pets yet. Add pets to view care history.
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="checkups">Check-ups ({checkups.length})</TabsTrigger>
                <TabsTrigger value="vaccines">Vaccinations ({petVaccinations.length})</TabsTrigger>
                <TabsTrigger value="treatments">Treatments ({treatments.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="checkups">
                <div className="flex justify-end gap-2 mb-2">
                  <Dialog
                    open={showCheckup}
                    onOpenChange={(o) => {
                      setShowCheckup(o);
                      if (!o) {
                        setEditingCheckupId(null);
                        resetCheckupForm();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={openAddCheckup}><Plus className="h-3 w-3 mr-1" /> Add Check-up</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingCheckupId ? "Edit check-up" : "Add check-up"} — {pet?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={checkupForm.date} onChange={(e) => setCheckupForm({ ...checkupForm, date: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Veterinarian</Label>
                            <Select value={checkupForm.vet} onValueChange={(v) => setCheckupForm({ ...checkupForm, vet: v })}>
                              <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                              <SelectContent>{VET_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Diagnosis</Label>
                          <Input value={checkupForm.diagnosis} onChange={(e) => setCheckupForm({ ...checkupForm, diagnosis: e.target.value })} placeholder="e.g. Healthy, mild infection" />
                        </div>
                        <div className="space-y-2">
                          <Label>Outcome</Label>
                          <Input value={checkupForm.outcome} onChange={(e) => setCheckupForm({ ...checkupForm, outcome: e.target.value })} placeholder="e.g. Recovered, ongoing care" />
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={checkupForm.notes} onChange={(e) => setCheckupForm({ ...checkupForm, notes: e.target.value })} rows={2} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCheckup(false)}>Cancel</Button>
                        <Button onClick={saveCheckup} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCheckupId ? "Update" : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => handlePrint("checkups")}><Printer className="h-3 w-3 mr-1" /> Print</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Vet</TableHead><TableHead>Diagnosis</TableHead><TableHead>Outcome</TableHead><TableHead className="w-[72px]"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {checkups.length ? checkups.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.date ? formatDate(c.date) : "—"}</TableCell>
                        <TableCell>{c.vet ?? "—"}</TableCell>
                        <TableCell>{c.diagnosis ?? "—"}</TableCell>
                        <TableCell>{c.outcome ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditCheckup(c)} aria-label="Edit check-up">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No records</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="vaccines">
                <div className="flex justify-end gap-2 mb-2">
                  <Dialog
                    open={showVaccine}
                    onOpenChange={(o) => {
                      setShowVaccine(o);
                      if (!o) {
                        setEditingVaccineId(null);
                        resetVaccineForm();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={openAddVaccine}><Plus className="h-3 w-3 mr-1" /> Add Vaccination</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingVaccineId ? "Edit vaccination" : "Add vaccination"} — {pet?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label>Vaccine type</Label>
                          <Input
                            value={vaccineForm.vaccine_type}
                            onChange={(e) => setVaccineForm({ ...vaccineForm, vaccine_type: e.target.value })}
                            placeholder="e.g. Rabies, DHPP"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date given</Label>
                            <Input type="date" value={vaccineForm.date_given} onChange={(e) => setVaccineForm({ ...vaccineForm, date_given: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Next due</Label>
                            <Input type="date" value={vaccineForm.next_due} onChange={(e) => setVaccineForm({ ...vaccineForm, next_due: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Veterinarian</Label>
                          <Select value={vaccineForm.vet} onValueChange={(v) => setVaccineForm({ ...vaccineForm, vet: v })}>
                            <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                            <SelectContent>{VET_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={vaccineForm.notes} onChange={(e) => setVaccineForm({ ...vaccineForm, notes: e.target.value })} rows={2} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowVaccine(false)}>Cancel</Button>
                        <Button onClick={saveVaccine} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVaccineId ? "Update" : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => handlePrint("vaccines")}><Printer className="h-3 w-3 mr-1" /> Print</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Vaccine</TableHead><TableHead>Date</TableHead><TableHead>Next Due</TableHead><TableHead>Vet</TableHead><TableHead className="w-[88px]"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {petVaccinations.length ? petVaccinations.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>{v.vaccine_type}</TableCell>
                        <TableCell>{v.date_given ? formatDate(v.date_given) : "—"}</TableCell>
                        <TableCell>{v.next_due ? formatDate(v.next_due) : "—"}</TableCell>
                        <TableCell>{v.vet ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditVaccine(v)} aria-label="Edit vaccination">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => printVaccineCertificate(v)} aria-label="Print certificate">
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No records</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="treatments">
                <div className="flex justify-end gap-2 mb-2">
                  <Dialog
                    open={showTreatment}
                    onOpenChange={(o) => {
                      setShowTreatment(o);
                      if (!o) {
                        setEditingTreatmentId(null);
                        resetTreatmentForm();
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={openAddTreatment}><Plus className="h-3 w-3 mr-1" /> Add Treatment</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingTreatmentId ? "Edit treatment" : "Add treatment"} — {pet?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Date</Label>
                            <Input type="date" value={treatmentForm.date} onChange={(e) => setTreatmentForm({ ...treatmentForm, date: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Veterinarian</Label>
                            <Select value={treatmentForm.vet} onValueChange={(v) => setTreatmentForm({ ...treatmentForm, vet: v })}>
                              <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                              <SelectContent>{VET_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Treatment</Label>
                          <Input value={treatmentForm.treatment} onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment: e.target.value })} placeholder="e.g. Wound cleaning" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Medication</Label>
                            <Input value={treatmentForm.medication} onChange={(e) => setTreatmentForm({ ...treatmentForm, medication: e.target.value })} />
                          </div>
                          <div className="space-y-2">
                            <Label>Dosage</Label>
                            <Input value={treatmentForm.dosage} onChange={(e) => setTreatmentForm({ ...treatmentForm, dosage: e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes</Label>
                          <Textarea value={treatmentForm.notes} onChange={(e) => setTreatmentForm({ ...treatmentForm, notes: e.target.value })} rows={2} />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTreatment(false)}>Cancel</Button>
                        <Button onClick={saveTreatment} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTreatmentId ? "Update" : "Save"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="sm" onClick={() => handlePrint("treatments")}><Printer className="h-3 w-3 mr-1" /> Print</Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead>Treatment</TableHead><TableHead>Date</TableHead><TableHead>Medication</TableHead><TableHead>Notes</TableHead><TableHead className="w-[72px]"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {treatments.length ? treatments.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>{t.treatment ?? "—"}</TableCell>
                        <TableCell>{t.date ? formatDate(t.date) : "—"}</TableCell>
                        <TableCell>{t.medication ?? "—"}</TableCell>
                        <TableCell>{t.notes ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditTreatment(t)} aria-label="Edit treatment">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No records</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
