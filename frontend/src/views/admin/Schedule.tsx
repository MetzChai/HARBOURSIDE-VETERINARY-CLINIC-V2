"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Printer,
  Loader2,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Calendar as CalendarIcon,
  List,
  Eye,
  Pencil,
  XCircle,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH, todayPH, isBeforeTodayPH } from "@/lib/datetime";
import {
  APPOINTMENT_SLOTS,
  VET_OPTIONS,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TYPES,
  getStatusBadgeClass,
  isSlotBlockingStatus,
} from "@/lib/appointment-slots";
import AppointmentDashboardCards from "@/components/AppointmentDashboardCards";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Schedule() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";

  const { data: appointments = [], isLoading } = useRows<any>("appointments", {
    orderBy: "date",
    ascending: false,
  });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const invalidate = useInvalidate();

  // Page view mode
  const [pageViewMode, setPageViewMode] = useState<"list" | "calendar">("list");

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterPetId, setFilterPetId] = useState("all");
  const [filterOwnerId, setFilterOwnerId] = useState("all");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    appointment_number: "",
    pet_id: "",
    walk_in_pet: "",
    walk_in_owner: "",
    date: todayPH(),
    time: "",
    vet: VET_OPTIONS[0] || "",
    appointment_type: "Check-up",
    reason: "",
    notes: "",
    type: "scheduled",
    status: "Scheduled",
  };

  const [form, setForm] = useState(emptyForm);

  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);

  const getPetName = (a: any) => {
    if (a.pet_id && petMap.has(a.pet_id)) return petMap.get(a.pet_id)?.name;
    if (a.notes?.startsWith("Walk-in pet: ")) return a.notes.replace("Walk-in pet: ", "").split(" | ")[0];
    return "Walk-in Pet";
  };

  const getOwnerName = (a: any) => {
    if (a.owner_id && ownerMap.has(a.owner_id)) return ownerMap.get(a.owner_id);
    if (a.pet_id && petMap.has(a.pet_id)) {
      const p = petMap.get(a.pet_id);
      if (p?.owner_id && ownerMap.has(p.owner_id)) return ownerMap.get(p.owner_id);
    }
    if (a.notes?.includes("Owner: ")) {
      const match = a.notes.match(/Owner:\s*([^|]+)/);
      if (match) return match[1].trim();
    }
    return "—";
  };

  // Slots taken for the date selected in the form
  const takenSlots = useMemo(() => {
    if (!form.date) return new Set<string>();
    return new Set(
      appointments
        .filter(
          (a) =>
            a.date === form.date &&
            a.id !== editingId &&
            ["Scheduled", "Approved", "Pending", "Requested"].includes(a.status)
        )
        .map((a) => a.time)
    );
  }, [appointments, form.date, editingId]);

  const availableSlots = APPOINTMENT_SLOTS.filter((s) => !takenSlots.has(s));

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      const petName = getPetName(a).toLowerCase();
      const ownerName = getOwnerName(a).toLowerCase();
      const aptNum = String(a.appointment_number || "").toLowerCase();

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!petName.includes(q) && !ownerName.includes(q) && !aptNum.includes(q) && !(a.reason || "").toLowerCase().includes(q)) {
          return false;
        }
      }

      // Status Filter
      if (filterStatus !== "all") {
        if (filterStatus === "Pending" && a.status !== "Pending" && a.status !== "Requested") return false;
        if (filterStatus !== "Pending" && a.status !== filterStatus) return false;
      }

      // Appointment Type Filter
      if (filterType !== "all") {
        const aType = String(a.appointment_type || a.care_type || "").toLowerCase();
        if (aType !== filterType.toLowerCase()) return false;
      }

      // Date Filter
      if (filterDate && a.date !== filterDate) return false;

      // Pet Filter
      if (filterPetId !== "all" && a.pet_id !== filterPetId) return false;

      // Owner Filter
      if (filterOwnerId !== "all" && a.owner_id !== filterOwnerId) return false;

      return true;
    });
  }, [appointments, searchQuery, filterStatus, filterType, filterDate, filterPetId, filterOwnerId]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      appointment_number: `APT-${Date.now().toString().slice(-6)}`,
      date: todayPH(),
    });
    setShowAddModal(true);
  };

  const openEditModal = (a: any) => {
    setEditingId(a.id);
    setForm({
      appointment_number: a.appointment_number || `APT-${a.id.slice(0, 6)}`,
      pet_id: a.pet_id || "",
      walk_in_pet: "",
      walk_in_owner: "",
      date: a.date,
      time: a.time,
      vet: a.vet || VET_OPTIONS[0],
      appointment_type: a.appointment_type || a.care_type || "Check-up",
      reason: a.reason || "",
      notes: a.notes || "",
      type: a.type || "scheduled",
      status: a.status || "Scheduled",
    });
    setShowAddModal(true);
  };

  const openViewModal = (a: any) => {
    setSelectedAppointment(a);
    setShowViewModal(true);
  };

  // Create / Update Booking Handler with validation
  const handleSaveAppointment = async () => {
    const isWalkIn = form.type === "walk_in";
    const hasPet = isWalkIn ? form.pet_id || form.walk_in_pet.trim() : form.pet_id;

    if (!hasPet || !form.date || !form.time || !form.vet) {
      toast.error("Pet, date, time, and veterinarian are required.");
      return;
    }

    if (isBeforeTodayPH(form.date)) {
      toast.error("Appointments cannot be booked in the past.");
      return;
    }

    // Check for duplicate booking for the same pet on same date/time
    if (form.pet_id) {
      const duplicate = appointments.find(
        (a) =>
          a.id !== editingId &&
          a.pet_id === form.pet_id &&
          a.date === form.date &&
          a.time === form.time &&
          a.status !== "Cancelled"
      );
      if (duplicate) {
        toast.error("This pet already has an appointment booked at this exact date and time.");
        return;
      }
    }

    setSaving(true);

    const aptNum = form.appointment_number || `APT-${Date.now().toString().slice(-6)}`;
    const petOwnerId = form.pet_id ? petMap.get(form.pet_id)?.owner_id || null : null;

    const payload = {
      appointment_number: aptNum,
      pet_id: form.pet_id || null,
      owner_id: petOwnerId,
      date: form.date,
      time: form.time,
      vet: form.vet,
      reason: form.reason.trim() || null,
      notes: form.notes.trim() || null,
      type: form.type,
      care_type: form.appointment_type,
      status: form.status,
      created_by: user?.email || "staff",
    };

    const { error, data } = editingId
      ? await db.from("appointments").update(payload as any).eq("id", editingId)
      : await db.from("appointments").insert(payload as any);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingId ? "Appointment updated successfully." : `Appointment ${aptNum} booked successfully.`);
    setShowAddModal(false);
    setEditingId(null);
    setForm(emptyForm);
    invalidate("appointments");
  };

  // Status Change Handler with automatic Care History creation
  const updateAppointmentStatus = async (id: string, status: string) => {
    const targetApt = appointments.find((a) => a.id === id);
    if (!targetApt) return;

    const { error, meta } = await db.from("appointments").update({ status } as any).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (status === "Completed") {
      if (meta?.careRecorded) {
        toast.success("Appointment marked as Completed — Care History record automatically created.");
        invalidate("care_records");
        invalidate("pets");
      } else if (meta?.careSkipReason) {
        toast.warning(`Marked as Completed, but Care History skipped: ${meta.careSkipReason}`);
      } else {
        toast.success("Appointment marked as Completed.");
      }
    } else {
      toast.success(`Appointment status updated to ${status}.`);
    }

    invalidate("appointments");
  };

  const handlePrintSchedule = () => {
    const w = window.open("", "_blank");
    if (!w) return;

    const rowsHtml = filteredAppointments
      .map(
        (a) => `
        <tr>
          <td>${a.appointment_number || "—"}</td>
          <td>${formatDate(a.date)}</td>
          <td>${a.time}</td>
          <td>${getPetName(a)}</td>
          <td>${getOwnerName(a)}</td>
          <td>${a.appointment_type || a.care_type || "Check-up"}</td>
          <td>${a.vet || "—"}</td>
          <td>${a.status}</td>
        </tr>
      `
      )
      .join("");

    w.document.write(`
      <html>
        <head>
          <title>Harbourside Veterinary Clinic - Appointment Schedule</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin-bottom: 4px; }
            h2 { color: #555; font-weight: normal; margin-top: 0; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Master Appointment Schedule Report</h2>
          <table>
            <thead>
              <tr>
                <th>Apt #</th>
                <th>Date</th>
                <th>Time (PHT)</th>
                <th>Pet</th>
                <th>Owner</th>
                <th>Type</th>
                <th>Veterinarian</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || "<tr><td colSpan='8' style='text-align:center'>No appointments found</td></tr>"}
            </tbody>
          </table>
          <div class="footer">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Appointment Scheduling & Management</h1>
          <p className="text-muted-foreground text-sm">
            Book, approve, reschedule, and complete clinic appointments (Philippine Time)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border">
            <Button
              variant={pageViewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPageViewMode("list")}
            >
              <List className="h-3.5 w-3.5 mr-1" /> List View
            </Button>
            <Button
              variant={pageViewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPageViewMode("calendar")}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Calendar
            </Button>
          </div>

          <Button variant="outline" onClick={handlePrintSchedule}>
            <Printer className="h-4 w-4 mr-1.5" /> Print
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-1.5" /> Book Appointment
          </Button>
        </div>
      </div>

      {/* Appointment Dashboard Metric Cards */}
      <AppointmentDashboardCards appointments={appointments} />

      {/* MAIN VIEW: LIST vs CALENDAR */}
      {pageViewMode === "calendar" ? (
        <AppointmentCalendar
          appointments={filteredAppointments}
          pets={pets}
          owners={owners}
          onSelectAppointment={openViewModal}
        />
      ) : (
        <div className="space-y-4">
          {/* Filter & Search Card */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" /> Filter & Search Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Pet Name, Owner Name, or Apt #..."
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {APPOINTMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Appointment Type Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Appointment Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {APPOINTMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t">
                {/* Date Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by Date</Label>
                  <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                </div>

                {/* Pet Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by Pet</Label>
                  <Select value={filterPetId} onValueChange={setFilterPetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Pets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Pets</SelectItem>
                      {pets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Owner Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Filter by Owner</Label>
                  <Select value={filterOwnerId} onValueChange={setFilterOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Owners" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Owners</SelectItem>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointments Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Apt Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time (PHT)</TableHead>
                    <TableHead>Pet</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAppointments.length ? (
                    filteredAppointments.map((a) => (
                      <TableRow key={a.id} className={a.status === "Pending" || a.status === "Requested" ? "bg-amber-50/40" : undefined}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {a.appointment_number || `APT-${a.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell>{formatDate(a.date)}</TableCell>
                        <TableCell className="font-semibold">{a.time}</TableCell>
                        <TableCell className="font-semibold text-primary">{getPetName(a)}</TableCell>
                        <TableCell>{getOwnerName(a)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {a.appointment_type || a.care_type || "Check-up"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select value={a.status} onValueChange={(val) => updateAppointmentStatus(a.id, val)}>
                            <SelectTrigger className="h-7 w-[130px] border-0 bg-transparent p-0 focus:ring-0">
                              <Badge variant="outline" className={`cursor-pointer ${getStatusBadgeClass(a.status)}`}>
                                {a.status}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {APPOINTMENT_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openViewModal(a)}
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEditModal(a)}
                              title="Edit / Reschedule"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            {(a.status === "Pending" || a.status === "Requested") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                                onClick={() => updateAppointmentStatus(a.id, "Approved")}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                              </Button>
                            )}

                            {a.status !== "Completed" && a.status !== "Cancelled" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                onClick={() => updateAppointmentStatus(a.id, "Completed")}
                              >
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No appointments found matching the criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Book / Edit Appointment Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit / Reschedule Appointment" : "Book New Appointment"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Appointment Number</Label>
                <Input value={form.appointment_number} disabled className="bg-muted font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label>Booking Mode</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Pet *</Label>
              <Select value={form.pet_id} onValueChange={(val) => setForm({ ...form, pet_id: val })}>
                <SelectTrigger>
                  <SelectValue placeholder={form.type === "walk_in" ? "Select pet (or enter walk-in name below)" : "Select pet"} />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
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
                  min={todayPH()}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value, time: "" })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Appointment Type *</Label>
                <Select
                  value={form.appointment_type}
                  onValueChange={(val) => setForm({ ...form, appointment_type: val })}
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

            {/* Time Slots */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> Time Slot (PH Time) *
              </Label>
              {!form.date ? (
                <p className="text-xs text-muted-foreground">Select a date to see open slots.</p>
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-destructive font-medium">No open time slots available on this date.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {APPOINTMENT_SLOTS.map((s) => {
                    const isTaken = takenSlots.has(s);
                    const isSelected = form.time === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={isTaken}
                        onClick={() => setForm({ ...form, time: s })}
                        className={`px-2.5 py-1 rounded text-xs border font-mono transition-colors ${
                          isTaken
                            ? "bg-muted text-muted-foreground/50 line-through cursor-not-allowed border-muted"
                            : isSelected
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Veterinarian *</Label>
                <Select value={form.vet} onValueChange={(val) => setForm({ ...form, vet: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vet" />
                  </SelectTrigger>
                  <SelectContent>
                    {VET_OPTIONS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason for Visit</Label>
              <Input
                placeholder="e.g. Annual vaccination, Ear infection, Coughing"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Special instructions or notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAppointment} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editingId ? "Save Changes" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
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
                    <span className="font-semibold text-primary">{getPetName(selectedAppointment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-muted-foreground">Owner</span>
                    <span className="font-medium">{getOwnerName(selectedAppointment)}</span>
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
                    <span className="font-medium">{selectedAppointment.vet || "Unassigned"}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground font-semibold block uppercase">Reason for Visit</span>
                  <p className="bg-background border p-2 rounded text-xs">{selectedAppointment.reason || "General visit"}</p>
                </div>

                {selectedAppointment.notes && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-semibold block uppercase">Notes</span>
                    <p className="bg-background border p-2 rounded text-xs whitespace-pre-wrap">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  Close
                </Button>
                {selectedAppointment.status !== "Completed" && (
                  <Button
                    onClick={() => {
                      setShowViewModal(false);
                      updateAppointmentStatus(selectedAppointment.id, "Completed");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Mark as Completed
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
