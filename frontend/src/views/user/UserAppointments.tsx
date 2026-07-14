"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Plus, Loader2, Clock } from "lucide-react";
import { useMyAppointments, useMyPets } from "@/hooks/useOwnerData";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { APPOINTMENT_SLOTS, CARE_TYPES, CARE_TYPE_LABELS, normalizeCareType } from "@/lib/appointment-slots";
import { formatDate } from "@/lib/age";
import { todayPH } from "@/lib/datetime";
import { toast } from "sonner";

function statusVariant(status: string) {
  const s = status?.toLowerCase();
  if (s === "completed") return "default";
  if (s === "requested") return "outline";
  if (s === "cancelled" || s === "missed") return "destructive";
  return "secondary";
}

export default function UserAppointments() {
  const { data: appointments = [], isLoading } = useMyAppointments();
  const { data: pets = [] } = useMyPets();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [form, setForm] = useState({ pet_id: "", date: "", time: "", reason: "", care_type: "checkup" });

  useEffect(() => {
    if (!form.date) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    fetch(`/api/appointments/availability?date=${form.date}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => setAvailableSlots(json.available ?? []))
      .catch(() => setAvailableSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [form.date]);

  const resetForm = () => setForm({ pet_id: "", date: "", time: "", reason: "", care_type: "checkup" });

  const submitRequest = async () => {
    if (!form.pet_id || !form.date || !form.time || !form.reason.trim()) {
      toast.error("Please fill in pet, date, time, and reason");
      return;
    }
    setSaving(true);
    const { error } = await db.from("appointments").insert({
      pet_id: form.pet_id,
      date: form.date,
      time: form.time,
      reason: form.reason.trim(),
      care_type: form.care_type,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Appointment request sent. The clinic will confirm soon.");
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["notif-appointments"] });
  };

  const sorted = useMemo(
    () =>
      [...appointments].sort((a: any, b: any) => {
        if (a.status === "Requested" && b.status !== "Requested") return -1;
        if (b.status === "Requested" && a.status !== "Requested") return 1;
        return String(b.date).localeCompare(String(a.date));
      }),
    [appointments]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">My Appointments</h2>
          <p className="text-muted-foreground text-sm">Request visits and track their status (Philippine Time)</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button disabled={pets.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Request Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Request an appointment</DialogTitle>
              </DialogHeader>
              {pets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  You need a registered pet before requesting an appointment. Contact the clinic to add your pet.
                </p>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Pet</Label>
                    <Select value={form.pet_id} onValueChange={(v) => setForm({ ...form, pet_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select pet" /></SelectTrigger>
                      <SelectContent>
                        {pets.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred date</Label>
                    <Input
                      type="date"
                      value={form.date}
                      min={todayPH()}
                      onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Clock className="h-4 w-4" /> Preferred time</Label>
                    {!form.date ? (
                      <p className="text-xs text-muted-foreground">Select a date to see open slots.</p>
                    ) : loadingSlots ? (
                      <p className="text-xs text-muted-foreground">Loading available times…</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs text-destructive">No slots available on this date.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {APPOINTMENT_SLOTS.map((s) => {
                          const available = availableSlots.includes(s);
                          const selected = form.time === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={!available}
                              onClick={() => setForm({ ...form, time: s })}
                              className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                                !available
                                  ? "bg-muted text-muted-foreground line-through cursor-not-allowed"
                                  : selected
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover:bg-accent border-border"
                              }`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Visit type</Label>
                    <Select value={form.care_type} onValueChange={(v) => setForm({ ...form, care_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CARE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{CARE_TYPE_LABELS[t]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason for visit</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder={
                        form.care_type === "vaccine"
                          ? "e.g. Rabies booster"
                          : form.care_type === "treatment"
                            ? "e.g. Skin rash follow-up"
                            : "e.g. Annual check-up"
                      }
                    />
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submitRequest} disabled={saving || pets.length === 0}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3 w-3 mr-1" /> Print
          </Button>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time (PHT)</TableHead>
                  <TableHead>Visit</TableHead>
                  <TableHead>Vet</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No appointments yet. Click Request Appointment to get started.
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.pets?.name ?? "—"}</TableCell>
                    <TableCell>{a.date ? formatDate(a.date) : "—"}</TableCell>
                    <TableCell>{a.time}</TableCell>
                    <TableCell>{CARE_TYPE_LABELS[normalizeCareType(a.care_type)]}</TableCell>
                    <TableCell>{a.vet ?? (a.status === "Requested" ? "Pending" : "—")}</TableCell>
                    <TableCell>{a.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(a.status)}>{a.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
