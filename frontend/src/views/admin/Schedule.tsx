"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Printer, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";
import { APPOINTMENT_SLOTS, VET_OPTIONS, CARE_TYPES, CARE_TYPE_LABELS, normalizeCareType } from "@/lib/appointment-slots";
import { toast } from "sonner";

const STATUSES = ["Scheduled", "Completed", "Missed", "Cancelled", "Requested"] as const;

const statusVariant = (s: string) => {
  if (s === "Completed") return "default";
  if (s === "Requested") return "outline";
  if (s === "Missed" || s === "Cancelled") return "destructive";
  return "secondary";
};

export default function Schedule() {
  const { data: appointments = [], isLoading } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const invalidate = useInvalidate();

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approveTarget, setApproveTarget] = useState<any | null>(null);
  const [approveVet, setApproveVet] = useState("");
  const [approveCareType, setApproveCareType] = useState("checkup");
  const [approving, setApproving] = useState(false);
  const emptyForm = { pet_id: "", walk_in_pet: "", walk_in_owner: "", date: "", time: "", vet: "", reason: "", type: "scheduled", care_type: "checkup" };
  const [form, setForm] = useState(emptyForm);

  const isWalkIn = form.type === "walk_in";

  const petName = (a: any) => {
    if (a.pet_id) return pets.find((p) => p.id === a.pet_id)?.name ?? "—";
    if (a.notes?.startsWith("Walk-in pet: ")) return a.notes.replace("Walk-in pet: ", "").split(" | ")[0];
    return "Walk-in";
  };
  const petOwner = (id: string) => pets.find((p) => p.id === id)?.owner_id ?? null;

  // Slots taken for the date currently selected in the form
  const takenSlots = useMemo(() => {
    if (!form.date) return new Set<string>();
    return new Set(
      appointments
        .filter((a) => a.date === form.date && a.status !== "Cancelled")
        .map((a) => a.time)
    );
  }, [appointments, form.date]);

  const availableSlots = APPOINTMENT_SLOTS.filter((s) => !takenSlots.has(s));

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      if (a.status === "Requested" && b.status !== "Requested") return -1;
      if (b.status === "Requested" && a.status !== "Requested") return 1;
      return String(b.date).localeCompare(String(a.date)) || String(a.time).localeCompare(String(b.time));
    });
  }, [appointments]);

  const requestedCount = appointments.filter((a) => a.status === "Requested").length;

  const careTypeLabel = (value: unknown) => CARE_TYPE_LABELS[normalizeCareType(value)];

  const reasonPlaceholder = (careType: string) => {
    if (careType === "vaccine") return "e.g. Rabies, DHPP";
    if (careType === "treatment") return "e.g. Wound dressing, ear infection";
    return "e.g. Annual check-up";
  };

  const updateStatus = async (id: string, status: string) => {
    const { error, meta } = await db.from("appointments").update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (status === "Completed") {
      if (meta?.careRecorded) {
        toast.success("Marked as Completed — added to Care History");
        invalidate("care_records");
        invalidate("vaccinations");
        invalidate("pets");
      } else if (meta?.careSkipReason) {
        toast.warning(`Completed, but not recorded: ${meta.careSkipReason}`);
      } else {
        toast.success("Marked as Completed");
      }
    } else {
      toast.success(`Marked as ${status}`);
    }
    invalidate("appointments");
  };

  const updateCareType = async (id: string, careType: string) => {
    const { error } = await db.from("appointments").update({ care_type: careType } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Visit type set to ${careTypeLabel(careType)}`);
    invalidate("appointments");
  };

  const approveRequest = async () => {
    if (!approveTarget || !approveVet) {
      toast.error("Select a veterinarian to approve");
      return;
    }
    setApproving(true);
    const { error } = await db
      .from("appointments")
      .update({ status: "Scheduled", vet: approveVet, type: "scheduled", care_type: approveCareType } as any)
      .eq("id", approveTarget.id);
    setApproving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Appointment approved");
    setApproveTarget(null);
    setApproveVet("");
    setApproveCareType("checkup");
    invalidate("appointments");
  };

  const handleSchedule = async () => {
    const hasPet = isWalkIn ? (form.pet_id || form.walk_in_pet.trim()) : form.pet_id;
    if (!hasPet || !form.date || !form.time || !form.vet) {
      toast.error("Please fill in pet, date, time and vet"); return;
    }
    if (takenSlots.has(form.time)) { toast.error("That time slot is already booked"); return; }
    setSaving(true);
    const walkInNote = isWalkIn && !form.pet_id && form.walk_in_pet.trim()
      ? `Walk-in pet: ${form.walk_in_pet.trim()}${form.walk_in_owner.trim() ? ` | Owner: ${form.walk_in_owner.trim()}` : ""}`
      : null;
    const { error } = await db.from("appointments").insert({
      pet_id: form.pet_id || null,
      owner_id: form.pet_id ? petOwner(form.pet_id) : null,
      date: form.date,
      time: form.time,
      vet: form.vet,
      reason: form.reason.trim() || null,
      notes: walkInNote,
      type: form.type,
      care_type: form.care_type,
      status: "Scheduled",
    } as any);
    if (error) { setSaving(false); toast.error(error.message); return; }
    const label = form.pet_id ? (pets.find((p) => p.id === form.pet_id)?.name ?? "Pet") : form.walk_in_pet.trim();

    // Auto-create a deworming record when the appointment is for deworming
    const isDeworming = /deworm/i.test(form.reason);
    if (isDeworming) {
      let dewormPetId = form.pet_id;

      // Walk-in with no registered pet: create a temporary pet entry first
      if (!dewormPetId && isWalkIn && form.walk_in_pet.trim()) {
        const { data: tempPet, error: petError } = await db
          .from("pets")
          .insert({
            owner_id: "00000000-0000-0000-0000-0000000000aa",
            name: form.walk_in_pet.trim(),
          } as any)
          .select("id")
          .single() as { data: { id: string } | null; error: { message: string } | null };
        if (petError) toast.error(`Walk-in pet entry failed: ${petError.message}`);
        else if (tempPet) dewormPetId = tempPet.id;
      }

      if (dewormPetId) {
        const { error: dwError } = await db.from("dewormings").insert({
          pet_id: dewormPetId,
          product: "To be administered",
          date_given: form.date,
          next_due: null,
          vet: form.vet,
          status: "Scheduled",
          notes: `Auto-created from appointment on ${form.date} at ${form.time}${isWalkIn && !form.pet_id && form.walk_in_owner.trim() ? ` | Walk-in owner: ${form.walk_in_owner.trim()}` : ""}`,
        } as any);
        if (dwError) toast.error(`Appointment booked, but deworming record failed: ${dwError.message}`);
        else { toast.success("Deworming record created"); invalidate("dewormings"); invalidate("pets"); }
      }
    }

    setSaving(false);
    toast.success(`${label} booked on ${form.date} at ${form.time}`);
    setForm(emptyForm);
    setShowAdd(false);
    invalidate("appointments");
  };


  const handlePrint = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`
      <html><head><title>Appointment Schedule</title>
      <style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#c0392b}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#fdecea;color:#c0392b}</style></head>
      <body><h1>Harbourside Veterinary Clinic</h1><h2>Appointment Schedule</h2>
      <table><tr><th>Pet</th><th>Date</th><th>Time</th><th>Vet</th><th>Visit</th><th>Reason</th><th>Type</th><th>Status</th></tr>
      ${appointments.map((a) => `<tr><td>${petName(a)}</td><td>${a.date}</td><td>${a.time}</td><td>${a.vet ?? "—"}</td><td>${careTypeLabel(a.care_type)}</td><td>${a.reason ?? "—"}</td><td>${a.type}</td><td>${a.status}</td></tr>`).join("")}
      </table><br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p></body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground text-sm">Book appointments with live time-slot availability (Philippine Time)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Print Schedule</Button>
          <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setForm(emptyForm); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Book Appointment</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="font-heading">Book Appointment</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label>Pet</Label>
                  <Select value={form.pet_id} onValueChange={(v) => setForm((f) => ({ ...f, pet_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={isWalkIn ? "Select registered pet (optional)" : "Select pet"} /></SelectTrigger>
                    <SelectContent>{pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {isWalkIn && !form.pet_id && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Input placeholder="Walk-in pet name" value={form.walk_in_pet} onChange={(e) => setForm((f) => ({ ...f, walk_in_pet: e.target.value }))} />
                      <Input placeholder="Owner name (optional)" value={form.walk_in_owner} onChange={(e) => setForm((f) => ({ ...f, walk_in_owner: e.target.value }))} />
                    </div>
                  )}
                  {isWalkIn && <p className="text-xs text-muted-foreground">For walk-ins, pick a registered pet or just type the pet's name.</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value, time: "" }))} />
                  </div>
                  <div className="space-y-2"><Label>Type</Label>
                    <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="walk_in">Walk-in</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Clock className="h-4 w-4" /> Available Time Slots</Label>
                  {!form.date ? (
                    <p className="text-xs text-muted-foreground">Select a date to see open slots.</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-xs text-destructive">No slots available on this date.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {APPOINTMENT_SLOTS.map((s) => {
                        const taken = takenSlots.has(s);
                        const selected = form.time === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={taken}
                            onClick={() => setForm((f) => ({ ...f, time: s }))}
                            className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                              taken ? "bg-muted text-muted-foreground line-through cursor-not-allowed"
                              : selected ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-accent border-border"
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {form.date && <p className="text-xs text-muted-foreground">{availableSlots.length} of {APPOINTMENT_SLOTS.length} slots open</p>}
                </div>

                <div className="space-y-2"><Label>Veterinarian</Label>
                  <Select value={form.vet} onValueChange={(v) => setForm((f) => ({ ...f, vet: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                    <SelectContent>{VET_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Visit type</Label>
                  <Select value={form.care_type} onValueChange={(v) => setForm((f) => ({ ...f, care_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CARE_TYPES.map((t) => <SelectItem key={t} value={t}>{CARE_TYPE_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">When completed, this visit is auto-recorded in Care History.</p>
                </div>
                <div className="space-y-2"><Label>Reason</Label>
                  <Input placeholder={reasonPlaceholder(form.care_type)} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowAdd(false); setForm(emptyForm); }}>Cancel</Button>
                <Button onClick={handleSchedule} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Book"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {requestedCount > 0 && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardContent className="py-3 text-sm">
            <strong>{requestedCount}</strong> appointment request{requestedCount === 1 ? "" : "s"} waiting for approval.
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Pet</TableHead><TableHead>Date</TableHead><TableHead>Time (PHT)</TableHead>
                <TableHead>Vet</TableHead><TableHead>Visit</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="w-[120px]"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {sortedAppointments.map((a) => (
                  <TableRow key={a.id} className={a.status === "Requested" ? "bg-primary/5" : undefined}>
                    <TableCell className="font-medium">{petName(a)}</TableCell>
                    <TableCell>{formatDate(a.date)}</TableCell>
                    <TableCell>{a.time}</TableCell>
                    <TableCell>{a.vet ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={normalizeCareType(a.care_type)} onValueChange={(v) => updateCareType(a.id, v)}>
                        <SelectTrigger className="h-8 w-[120px] border-0 bg-transparent p-0 hover:bg-accent/50 focus:ring-1">
                          <span className="text-sm">{careTypeLabel(a.care_type)}</span>
                        </SelectTrigger>
                        <SelectContent>{CARE_TYPES.map((t) => <SelectItem key={t} value={t}>{CARE_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="capitalize">{String(a.type).replace("_", "-")}</TableCell>
                    <TableCell>{a.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={(v) => updateStatus(a.id, v)}>
                        <SelectTrigger className="h-8 w-[140px] border-0 bg-transparent p-0 hover:bg-accent/50 focus:ring-1">
                          <Badge variant={statusVariant(a.status)} className="cursor-pointer">{a.status}</Badge>
                        </SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {a.status === "Requested" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            setApproveTarget(a);
                            setApproveVet(a.vet ?? "");
                            setApproveCareType(normalizeCareType(a.care_type));
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {sortedAppointments.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No appointments yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!approveTarget} onOpenChange={(o) => { if (!o) { setApproveTarget(null); setApproveVet(""); setApproveCareType("checkup"); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve appointment request</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                {petName(approveTarget)} — {formatDate(approveTarget.date)} at {approveTarget.time}
                {approveTarget.reason ? ` · ${approveTarget.reason}` : ""}
              </p>
              <div className="space-y-2">
                <Label>Visit type</Label>
                <Select value={approveCareType} onValueChange={setApproveCareType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CARE_TYPES.map((t) => <SelectItem key={t} value={t}>{CARE_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign veterinarian</Label>
                <Select value={approveVet} onValueChange={setApproveVet}>
                  <SelectTrigger><SelectValue placeholder="Select vet" /></SelectTrigger>
                  <SelectContent>{VET_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button onClick={approveRequest} disabled={approving}>
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

