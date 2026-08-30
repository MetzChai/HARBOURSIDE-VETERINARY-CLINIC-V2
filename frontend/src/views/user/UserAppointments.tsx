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
import { Printer, Plus, Loader2, Clock, XCircle, Eye, Calendar } from "lucide-react";
import { useMyAppointments, useMyPets } from "@/hooks/useOwnerData";
import { useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import {
  APPOINTMENT_SLOTS,
  APPOINTMENT_TYPES,
  getStatusBadgeClass,
} from "@/lib/appointment-slots";
import { formatDate } from "@/lib/age";
import { todayPH, isBeforeTodayPH, daysFromTodayPH } from "@/lib/datetime";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UserAppointments() {
  const { data: appointments = [], isLoading } = useMyAppointments();
  const { data: pets = [] } = useMyPets();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const [form, setForm] = useState({
    pet_id: "",
    date: todayPH(),
    time: "",
    reason: "",
    appointment_type: "Check-up",
  });

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

  const resetForm = () =>
    setForm({ pet_id: (pets[0] as any)?.id || "", date: todayPH(), time: "", reason: "", appointment_type: "Check-up" });

  const submitRequest = async () => {
    if (!form.pet_id || !form.date || !form.time || !form.reason.trim()) {
      toast.error("Please fill in pet, date, time, and reason.");
      return;
    }

    if (isBeforeTodayPH(form.date)) {
      toast.error("Appointments cannot be requested in the past.");
      return;
    }

    // Check duplicate booking for pet
    const duplicate = appointments.find(
      (a: any) =>
        a.pet_id === form.pet_id &&
        a.date === form.date &&
        a.time === form.time &&
        a.status !== "Cancelled"
    );
    if (duplicate) {
      toast.error("Your pet already has an appointment booked on this date and time.");
      return;
    }

    setSaving(true);
    const aptNum = `APT-${Date.now().toString().slice(-6)}`;

    const { error } = await db.from("appointments").insert({
      appointment_number: aptNum,
      pet_id: form.pet_id,
      date: form.date,
      time: form.time,
      reason: form.reason.trim(),
      care_type: form.appointment_type,
      status: "Requested",
      type: "request",
    } as any);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Appointment request ${aptNum} submitted. The clinic will review and confirm.`);
    setOpen(false);
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["notif-appointments"] });
  };

  const cancelPendingRequest = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment request?")) return;

    setCancellingId(id);
    const { error } = await db
      .from("appointments")
      .update({ status: "Cancelled" } as any)
      .eq("id", id);
    setCancellingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Appointment request cancelled.");
    queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["notif-appointments"] });
  };

  const sorted = useMemo(
    () =>
      [...appointments].sort((a: any, b: any) => {
        if ((a.status === "Pending" || a.status === "Requested") && b.status !== "Pending" && b.status !== "Requested")
          return -1;
        if ((b.status === "Pending" || b.status === "Requested") && a.status !== "Pending" && a.status !== "Requested")
          return 1;
        return String(b.date).localeCompare(String(a.date));
      }),
    [appointments]
  );

  const requested = useMemo(
    () => sorted.filter((a: any) => a.status === "Requested" || a.status === "Pending"),
    [sorted],
  );
  const upcoming = useMemo(
    () =>
      sorted.filter(
        (a: any) =>
          a.status !== "Cancelled" &&
          a.status !== "Completed" &&
          a.status !== "Missed" &&
          a.status !== "Requested" &&
          a.status !== "Pending" &&
          (daysFromTodayPH(a.date) ?? -1) >= 0,
      ),
    [sorted],
  );
  const completed = useMemo(
    () => sorted.filter((a: any) => a.status === "Completed" || a.status === "Missed"),
    [sorted],
  );
  const cancelled = useMemo(
    () => sorted.filter((a: any) => a.status === "Cancelled"),
    [sorted],
  );

  const renderTable = (rows: any[]) => (
    <Card>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-navy" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No appointments found."
            description="Request a visit and the clinic will review your booking."
          />
        ) : (
          <div className="data-table-wrap border-0 shadow-none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apt Number</TableHead>
                  <TableHead>Pet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time (PHT)</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Veterinarian</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs font-bold text-brand-navy">
                      {a.appointment_number || `APT-${a.id.slice(0, 6)}`}
                    </TableCell>
                    <TableCell className="font-semibold">{a.pets?.name ?? "—"}</TableCell>
                    <TableCell>{a.date ? formatDate(a.date) : "—"}</TableCell>
                    <TableCell className="font-semibold">{a.time}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {a.appointment_type || a.care_type || "Check-up"}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.vet ?? (a.status === "Pending" || a.status === "Requested" ? "Unassigned" : "—")}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{a.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeClass(a.status)}>
                        {a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedAppointment(a);
                            setShowDetails(true);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {(a.status === "Pending" || a.status === "Requested") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-red-50"
                            onClick={() => cancelPendingRequest(a.id)}
                            disabled={cancellingId === a.id}
                          >
                            {cancellingId === a.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="page-container">
      <PageHeader
        title="My Appointments"
        description="Request clinic visits, track booking status, and view appointment history"
        actions={
          <div className="flex gap-2">
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (o && !form.pet_id && pets.length > 0) setForm((f) => ({ ...f, pet_id: (pets[0] as any).id }));
              if (!o) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={pets.length === 0}>
                <Plus className="h-4 w-4 mr-1.5" /> Request Appointment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Request Clinic Appointment</DialogTitle>
              </DialogHeader>
              {pets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  You need a registered pet before requesting an appointment. Please contact the clinic.
                </p>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Select Pet *</Label>
                    <Select value={form.pet_id} onValueChange={(v) => setForm({ ...form, pet_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select pet" />
                      </SelectTrigger>
                      <SelectContent>
                        {pets.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.species || "Pet"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Preferred Date *</Label>
                      <Input
                        type="date"
                        value={form.date}
                        min={todayPH()}
                        onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Appointment Type *</Label>
                      <Select
                        value={form.appointment_type}
                        onValueChange={(v) => setForm({ ...form, appointment_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {APPOINTMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> Preferred Time Slot (PH Time) *
                    </Label>
                    {!form.date ? (
                      <p className="text-xs text-muted-foreground">Select a date to view available time slots.</p>
                    ) : loadingSlots ? (
                      <p className="text-xs text-muted-foreground">Checking open slots...</p>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-xs text-destructive font-medium">No open time slots on this date.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {APPOINTMENT_SLOTS.map((s) => {
                          const available = availableSlots.includes(s);
                          const selected = form.time === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={!available}
                              onClick={() => setForm({ ...form, time: s })}
                              className={`px-2.5 py-1 rounded text-xs border font-mono transition-colors ${
                                !available
                                  ? "bg-muted text-muted-foreground/50 line-through cursor-not-allowed border-muted"
                                  : selected
                                  ? "bg-primary text-primary-foreground border-primary font-bold"
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

                  <div className="space-y-1.5">
                    <Label>Reason for Visit *</Label>
                    <Input
                      value={form.reason}
                      onChange={(e) => setForm({ ...form, reason: e.target.value })}
                      placeholder="e.g. Annual vaccination, Skin rash, General check-up"
                    />
                  </div>
                </div>
              )}
              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitRequest} disabled={saving || pets.length === 0}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Submit Appointment Request"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
        </div>
        }
      />

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="requested">Requested ({requested.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          <TabsTrigger value="all">All ({sorted.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">{renderTable(upcoming)}</TabsContent>
        <TabsContent value="requested">{renderTable(requested)}</TabsContent>
        <TabsContent value="completed">{renderTable(completed)}</TabsContent>
        <TabsContent value="cancelled">{renderTable(cancelled)}</TabsContent>
        <TabsContent value="all">{renderTable(sorted)}</TabsContent>
      </Tabs>

      {/* Appointment Details Modal for Owner */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          {selectedAppointment && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-mono text-sm font-bold text-primary">
                    {selectedAppointment.appointment_number || `APT-${selectedAppointment.id.slice(0, 6)}`}
                  </DialogTitle>
                  <Badge variant="outline" className={getStatusBadgeClass(selectedAppointment.status)}>
                    {selectedAppointment.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-sm">
                <div className="bg-muted/40 p-3 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Pet</span>
                    <span className="font-semibold text-primary">{selectedAppointment.pets?.name || "Pet"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Date & Time</span>
                    <span className="font-medium">
                      {formatDate(selectedAppointment.date)} at {selectedAppointment.time}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Appointment Type</span>
                    <span className="font-medium">{selectedAppointment.appointment_type || selectedAppointment.care_type || "Check-up"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Veterinarian</span>
                    <span className="font-medium">{selectedAppointment.vet || "Assigned upon approval"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Reason for Visit</span>
                  <p className="bg-background border p-2 rounded text-xs">{selectedAppointment.reason || "General visit"}</p>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
