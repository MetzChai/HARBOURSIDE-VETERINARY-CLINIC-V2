"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Loader2, Plus, Pencil, Trash2, Eye, Search, Filter, Calendar } from "lucide-react";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";
import { db } from "@/lib/db-client";
import { VET_OPTIONS } from "@/lib/appointment-slots";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

function toInputDate(value?: string | null) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatCareTypeLabel(type?: string | null) {
  switch (String(type ?? "").toLowerCase()) {
    case "vaccination":
    case "vaccine":
      return "Vaccination";
    case "treatment":
      return "Treatment";
    case "deworming":
      return "Deworming";
    case "checkup":
    default:
      return "Check-up";
  }
}

function getCareTypeBadgeClass(type?: string | null) {
  switch (String(type ?? "").toLowerCase()) {
    case "vaccination":
    case "vaccine":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "treatment":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "deworming":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "checkup":
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

export default function CareHistory() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: pets = [], isLoading: petsLoading } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: careRecords = [], isLoading: recordsLoading } = useRows<any>("care_records", {
    orderBy: "date",
    ascending: false,
  });
  const { data: inventoryItems = [] } = useRows<any>("inventory_items", { orderBy: "name" });
  const invalidate = useInvalidate();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPetId, setFilterPetId] = useState("all");
  const [filterOwnerId, setFilterOwnerId] = useState("all");
  const [filterCareType, setFilterCareType] = useState("all");
  const [filterVet, setFilterVet] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Modals & form state
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    appointment_id: "",
    pet_id: "",
    vet: "",
    date: toInputDate(new Date().toISOString()),
    record_type: "checkup",
    chief_complaint: "",
    symptoms: "",
    diagnosis: "",
    findings: "",
    treatment: "",
    medication: "",
    medication_qty: 1,
    vaccine_used: "",
    next_vax_due: "",
    dewormer_used: "",
    next_deworming_due: "",
    outcome: "Completed",
    notes: "",
  });

  const ownerMap = new Map(owners.map((o) => [o.id, o.name]));
  const petMap = new Map(pets.map((p) => [p.id, p]));

  const searchParams = useSearchParams();
  const aptId = searchParams?.get("aptId");
  const [autoOpenedAptId, setAutoOpenedAptId] = useState<string | null>(null);

  useEffect(() => {
    if (!aptId || autoOpenedAptId === aptId) return;

    const existingRecord = careRecords.find((r: any) => r.appointment_id === aptId);
    if (existingRecord) {
      openEditModal(existingRecord);
      setAutoOpenedAptId(aptId);
      return;
    }

    const targetApt = appointments.find((a: any) => a.id === aptId);
    if (targetApt) {
      const rawCare = targetApt.care_type || targetApt.appointment_type || targetApt.type || "checkup";
      const normCare = String(rawCare).toLowerCase() === "vaccine" ? "vaccination" : String(rawCare).toLowerCase();

      setEditingId(null);
      setForm({
        appointment_id: targetApt.id,
        pet_id: targetApt.pet_id || "",
        vet: targetApt.vet || VET_OPTIONS[0] || "",
        date: toInputDate(targetApt.date),
        record_type: normCare,
        chief_complaint: targetApt.reason || "",
        symptoms: "",
        diagnosis: "",
        findings: "",
        treatment: "",
        medication: "",
        medication_qty: 1,
        vaccine_used: "",
        next_vax_due: "",
        dewormer_used: "",
        next_deworming_due: "",
        outcome: "Completed",
        notes: targetApt.notes || "",
      });
      setShowEditModal(true);
      setAutoOpenedAptId(aptId);
    }
  }, [aptId, appointments, careRecords, autoOpenedAptId]);

  // Filter logic
  const filteredRecords = careRecords.filter((record) => {
    const pet = petMap.get(record.pet_id);
    const petName = pet?.name || "";
    const ownerName = pet?.owner_id ? ownerMap.get(pet.owner_id) || "" : "";
    const diagnosis = record.diagnosis || "";
    const careTypeLabel = formatCareTypeLabel(record.record_type);

    // Search query filter (Pet Name, Owner Name, Diagnosis)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        petName.toLowerCase().includes(q) ||
        ownerName.toLowerCase().includes(q) ||
        diagnosis.toLowerCase().includes(q) ||
        (record.notes || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    // Pet filter
    if (filterPetId !== "all" && record.pet_id !== filterPetId) return false;

    // Owner filter
    if (filterOwnerId !== "all" && pet?.owner_id !== filterOwnerId) return false;

    // Care Type filter
    if (filterCareType !== "all") {
      const normRecordType = String(record.record_type || "").toLowerCase();
      const normFilter = filterCareType.toLowerCase();
      if (normFilter === "vaccination") {
        if (normRecordType !== "vaccination" && normRecordType !== "vaccine") return false;
      } else if (normRecordType !== normFilter) {
        return false;
      }
    }

    // Vet filter
    if (filterVet !== "all" && (record.vet || "") !== filterVet) return false;

    // Date range filter
    if (startDate && record.date < startDate) return false;
    if (endDate && record.date > endDate) return false;

    return true;
  });

  const resetForm = () => {
    setForm({
      appointment_id: "",
      pet_id: pets[0]?.id || "",
      vet: VET_OPTIONS[0] || "",
      date: toInputDate(new Date().toISOString()),
      record_type: "checkup",
      chief_complaint: "",
      symptoms: "",
      diagnosis: "",
      findings: "",
      treatment: "",
      medication: "",
      medication_qty: 1,
      vaccine_used: "",
      next_vax_due: "",
      dewormer_used: "",
      next_deworming_due: "",
      outcome: "Completed",
      notes: "",
    });
  };

  const openAddModal = () => {
    setEditingId(null);
    resetForm();
    setShowEditModal(true);
  };

  const openEditModal = (record: any) => {
    setEditingId(record.id);
    setForm({
      appointment_id: record.appointment_id || "",
      pet_id: record.pet_id || "",
      vet: record.vet || "",
      date: toInputDate(record.date),
      record_type: String(record.record_type || "checkup").toLowerCase() === "vaccine" ? "vaccination" : record.record_type || "checkup",
      chief_complaint: record.chief_complaint || "",
      symptoms: record.symptoms || "",
      diagnosis: record.diagnosis || "",
      findings: record.findings || "",
      treatment: record.treatment || "",
      medication: record.medication || "",
      medication_qty: record.medication_qty || 1,
      vaccine_used: record.vaccine_used || "",
      next_vax_due: toInputDate(record.next_vax_due),
      dewormer_used: record.dewormer_used || "",
      next_deworming_due: toInputDate(record.next_deworming_due),
      outcome: record.outcome || "Completed",
      notes: record.notes || "",
    });
    setShowEditModal(true);
  };

  const openViewModal = (record: any) => {
    setSelectedRecord(record);
    setShowViewModal(true);
  };

  const handleSave = async () => {
    if (!form.pet_id || !form.date || !form.vet.trim()) {
      toast.error("Pet, visit date, and veterinarian/staff are required.");
      return;
    }

    setSaving(true);
    const payload = {
      pet_id: form.pet_id,
      appointment_id: form.appointment_id || null,
      date: form.date,
      vet: form.vet,
      record_type: form.record_type,
      chief_complaint: form.chief_complaint.trim() || null,
      symptoms: form.symptoms.trim() || null,
      diagnosis: form.diagnosis.trim() || null,
      findings: form.findings.trim() || null,
      treatment: form.treatment.trim() || null,
      medication: form.medication.trim() || null,
      medication_qty: Number(form.medication_qty) || 1,
      vaccine_used: form.vaccine_used.trim() || null,
      next_vax_due: form.next_vax_due || null,
      dewormer_used: form.dewormer_used.trim() || null,
      next_deworming_due: form.next_deworming_due || null,
      outcome: form.outcome.trim() || null,
      notes: form.notes.trim() || null,
    };

    const { error } = editingId
      ? await db.from("care_records").update(payload as any).eq("id", editingId)
      : await db.from("care_records").insert(payload as any);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editingId ? "Care History record updated." : "Care History record saved successfully.");
    setShowEditModal(false);
    setEditingId(null);
    resetForm();
    invalidate("care_records");
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error("Staff members are not permitted to delete Care History records.");
      return;
    }
    if (!confirm("Are you sure you want to delete this Care History record? This action cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    const { error } = await db.from("care_records").delete().eq("id", id);
    setDeletingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Care History record deleted.");
    invalidate("care_records");
  };

  const handlePrint = (record?: any) => {
    const recordsToPrint = record ? [record] : filteredRecords;
    const w = window.open("", "_blank");
    if (!w) return;

    const rowsHtml = recordsToPrint
      .map((r) => {
        const pet = petMap.get(r.pet_id);
        const ownerName = pet?.owner_id ? ownerMap.get(pet.owner_id) || "—" : "—";
        return `
          <tr>
            <td>${r.date ? formatDate(r.date) : "—"}</td>
            <td>${pet?.name || "—"}</td>
            <td>${ownerName}</td>
            <td>${formatCareTypeLabel(r.record_type)}</td>
            <td>${r.vet || "—"}</td>
            <td>${r.diagnosis || r.treatment || r.vaccine_used || r.dewormer_used || "—"}</td>
            <td>${r.notes || "—"}</td>
          </tr>
        `;
      })
      .join("");

    w.document.write(`
      <html>
        <head>
          <title>Harbourside Veterinary Clinic - Care History Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin-bottom: 4px; }
            h2 { color: #555; font-weight: normal; margin-top: 0; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Care History & Medical Records</h2>
          <table>
            <thead>
              <tr>
                <th>Visit Date</th>
                <th>Pet</th>
                <th>Owner</th>
                <th>Care Type</th>
                <th>Vet / Staff</th>
                <th>Diagnosis / Treatment</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || "<tr><td colSpan='7' style='text-align:center'>No records found</td></tr>"}
            </tbody>
          </table>
          <div class="footer">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic Management System</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  const selectedPetObject = petMap.get(form.pet_id);
  const selectedPetOwnerName = selectedPetObject?.owner_id ? ownerMap.get(selectedPetObject.owner_id) || "Unassigned" : "Unassigned";

  if (petsLoading || recordsLoading) {
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
          <h1 className="font-heading text-2xl font-bold">Central Care History</h1>
          <p className="text-muted-foreground text-sm">
            Unified medical records for Check-ups, Vaccinations, Treatments, and Dewormings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handlePrint()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Records
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Care Record
          </Button>
        </div>
      </div>

      {/* Filter and Search Card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Pet Name, Owner Name, or Diagnosis..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Care Type Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Care Type</Label>
              <Select value={filterCareType} onValueChange={setFilterCareType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Care Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Care Types</SelectItem>
                  <SelectItem value="checkup">Check-up</SelectItem>
                  <SelectItem value="vaccination">Vaccination</SelectItem>
                  <SelectItem value="treatment">Treatment</SelectItem>
                  <SelectItem value="deworming">Deworming</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vet Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Veterinarian / Staff</Label>
              <Select value={filterVet} onValueChange={setFilterVet}>
                <SelectTrigger>
                  <SelectValue placeholder="All Vets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vets</SelectItem>
                  {VET_OPTIONS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1 border-t">
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

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            {/* End Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Records Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visit Date</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Care Type</TableHead>
                <TableHead>Veterinarian / Staff</TableHead>
                <TableHead>Status / Details</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length ? (
                filteredRecords.map((r) => {
                  const pet = petMap.get(r.pet_id);
                  const ownerName = pet?.owner_id ? ownerMap.get(pet.owner_id) || "—" : "—";
                  const detailSnippet =
                    r.diagnosis || r.treatment || r.vaccine_used || r.dewormer_used || r.chief_complaint || "—";

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.date ? formatDate(r.date) : "—"}</TableCell>
                      <TableCell className="font-semibold text-primary">{pet?.name || "—"}</TableCell>
                      <TableCell>{ownerName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCareTypeBadgeClass(r.record_type)}>
                          {formatCareTypeLabel(r.record_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.vet || "—"}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{detailSnippet}</TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openViewModal(r)}
                            title="View Record"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openEditModal(r)}
                            title="Edit Record"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(r.id)}
                              disabled={deletingId === r.id}
                              title="Delete Record (Admin Only)"
                            >
                              {deletingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handlePrint(r)}
                            title="Print Record"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No Care History records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Care Record Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Care History Record" : "Add Care History Record"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* General Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                General Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Care Record ID</Label>
                  <Input value={editingId || "Auto-generated UUID"} disabled className="bg-muted text-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Appointment</Label>
                  <Select
                    value={form.appointment_id}
                    onValueChange={(val) => setForm({ ...form, appointment_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select completed appointment (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Direct record entry)</SelectItem>
                      {appointments.map((a) => {
                        const p = petMap.get(a.pet_id);
                        return (
                          <SelectItem key={a.id} value={a.id}>
                            {a.date} ({p?.name || "Pet"}) — {a.reason || a.status}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Pet *</Label>
                  <Select value={form.pet_id} onValueChange={(val) => setForm({ ...form, pet_id: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select pet" />
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
                <div className="space-y-1.5">
                  <Label>Pet Owner</Label>
                  <Input value={selectedPetOwnerName} disabled className="bg-muted" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Care Type *</Label>
                  <Select value={form.record_type} onValueChange={(val) => setForm({ ...form, record_type: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checkup">Check-up</SelectItem>
                      <SelectItem value="vaccination">Vaccination</SelectItem>
                      <SelectItem value="treatment">Treatment</SelectItem>
                      <SelectItem value="deworming">Deworming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Visit Date *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Veterinarian / Staff *</Label>
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
              </div>
            </div>

            {/* Medical Information */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                Medical Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Chief Complaint / Reason</Label>
                  <Input
                    value={form.chief_complaint}
                    onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })}
                    placeholder="e.g. Routine checkup, vomiting, booster shot"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Symptoms</Label>
                  <Input
                    value={form.symptoms}
                    onChange={(e) => setForm({ ...form, symptoms: e.target.value })}
                    placeholder="e.g. Lethargy, fever, loss of appetite"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Diagnosis</Label>
                  <Input
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="e.g. Ear Infection, Healthy, Gastroenteritis"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Clinical Findings</Label>
                  <Input
                    value={form.findings}
                    onChange={(e) => setForm({ ...form, findings: e.target.value })}
                    placeholder="e.g. Clear lungs, mild inflammation"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Treatment Notes</Label>
                <Textarea
                  value={form.treatment}
                  onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                  placeholder="e.g. Administered ear drops, fluid therapy"
                  rows={2}
                />
              </div>
            </div>

            {/* Medication Section */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
                Medication & Inventory Adjustment
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <Label>Medication / Product Used</Label>
                  <Input
                    value={form.medication}
                    onChange={(e) => setForm({ ...form, medication: e.target.value })}
                    placeholder="e.g. Amoxicillin, Eye Drops, Paracetamol"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Quantity Used</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.medication_qty}
                    onChange={(e) => setForm({ ...form, medication_qty: Math.max(1, parseInt(e.target.value) || 1) })}
                  />
                </div>
              </div>
            </div>

            {/* Vaccination Specific Fields */}
            {(form.record_type === "vaccination" || form.record_type === "vaccine") && (
              <div className="space-y-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-blue-800 border-b border-blue-200 pb-1">
                  Vaccination Details & Reminder Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Vaccine Administered</Label>
                    <Input
                      value={form.vaccine_used}
                      onChange={(e) => setForm({ ...form, vaccine_used: e.target.value })}
                      placeholder="e.g. Rabies Vaccine, DHPP Booster"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next Vaccination Due Date</Label>
                    <Input
                      type="date"
                      value={form.next_vax_due}
                      onChange={(e) => setForm({ ...form, next_vax_due: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Deworming Specific Fields */}
            {form.record_type === "deworming" && (
              <div className="space-y-4 p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800 border-b border-amber-200 pb-1">
                  Deworming Details & Reminder Schedule
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Dewormer Administered</Label>
                    <Input
                      value={form.dewormer_used}
                      onChange={(e) => setForm({ ...form, dewormer_used: e.target.value })}
                      placeholder="e.g. Drontal Plus, Pyrantel Pamoate"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Next Deworming Due Date</Label>
                    <Input
                      type="date"
                      value={form.next_deworming_due}
                      onChange={(e) => setForm({ ...form, next_deworming_due: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Additional Notes */}
            <div className="space-y-1.5">
              <Label>Additional Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Any special instructions or follow-up notes..."
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editingId ? "Update Record" : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-Only View Record Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="flex items-center gap-2">
                    Care Record: {petMap.get(selectedRecord.pet_id)?.name || "Pet"}
                  </DialogTitle>
                  <Badge variant="outline" className={getCareTypeBadgeClass(selectedRecord.record_type)}>
                    {formatCareTypeLabel(selectedRecord.record_type)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-sm">
                <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 rounded-lg">
                  <div>
                    <span className="text-xs text-muted-foreground block">Visit Date</span>
                    <span className="font-semibold">{formatDate(selectedRecord.date)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Veterinarian / Staff</span>
                    <span className="font-semibold">{selectedRecord.vet || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Owner</span>
                    <span className="font-semibold">
                      {petMap.get(selectedRecord.pet_id)?.owner_id
                        ? ownerMap.get(petMap.get(selectedRecord.pet_id)!.owner_id) || "—"
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Status</span>
                    <span className="font-semibold">{selectedRecord.outcome || "Completed"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Medical Overview
                  </h4>
                  {selectedRecord.chief_complaint && (
                    <p>
                      <strong>Chief Complaint:</strong> {selectedRecord.chief_complaint}
                    </p>
                  )}
                  {selectedRecord.symptoms && (
                    <p>
                      <strong>Symptoms:</strong> {selectedRecord.symptoms}
                    </p>
                  )}
                  {selectedRecord.diagnosis && (
                    <p>
                      <strong>Diagnosis:</strong> {selectedRecord.diagnosis}
                    </p>
                  )}
                  {selectedRecord.findings && (
                    <p>
                      <strong>Findings:</strong> {selectedRecord.findings}
                    </p>
                  )}
                  {selectedRecord.treatment && (
                    <p>
                      <strong>Treatment Notes:</strong> {selectedRecord.treatment}
                    </p>
                  )}
                </div>

                {(selectedRecord.medication || selectedRecord.medication_qty) && (
                  <div className="space-y-1.5 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Medication Prescribed
                    </h4>
                    <p>
                      <strong>Medicine:</strong> {selectedRecord.medication || "N/A"}{" "}
                      (Qty: {selectedRecord.medication_qty || 1})
                    </p>
                  </div>
                )}

                {selectedRecord.vaccine_used && (
                  <div className="space-y-1.5 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Vaccination
                    </h4>
                    <p>
                      <strong>Vaccine:</strong> {selectedRecord.vaccine_used}
                    </p>
                    <p>
                      <strong>Next Vaccination Due:</strong>{" "}
                      {selectedRecord.next_vax_due ? formatDate(selectedRecord.next_vax_due) : "N/A"}
                    </p>
                  </div>
                )}

                {selectedRecord.dewormer_used && (
                  <div className="space-y-1.5 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Deworming
                    </h4>
                    <p>
                      <strong>Dewormer:</strong> {selectedRecord.dewormer_used}
                    </p>
                    <p>
                      <strong>Next Deworming Due:</strong>{" "}
                      {selectedRecord.next_deworming_due ? formatDate(selectedRecord.next_deworming_due) : "N/A"}
                    </p>
                  </div>
                )}

                {selectedRecord.notes && (
                  <div className="space-y-1 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Additional Notes
                    </h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedRecord.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  Close
                </Button>
                <Button onClick={() => handlePrint(selectedRecord)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Certificate / Record
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
