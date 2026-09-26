"use client";

import { printDocument } from "@/lib/print";
import { useState, useEffect, useMemo } from "react";
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
import { Printer, Loader2, Plus, Pencil, Trash2, Eye, Search, Filter, Calendar, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH, isBeforeTodayPH } from "@/lib/datetime";
import { db } from "@/lib/db-client";
import { VET_OPTIONS } from "@/lib/appointment-slots";
import { useAuth } from "@/hooks/useAuth";
import { processPrescribedMedications } from "@/lib/careHistoryStock";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

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
      return "bg-brand-navy-light text-brand-navy border-brand-navy/20";
    case "treatment":
      return "bg-brand-teal-light text-brand-teal border-brand-teal/30";
    case "deworming":
      return "bg-amber-50 text-amber-800 border-amber-300";
    case "checkup":
    default:
      return "bg-brand-green-light text-brand-green border-brand-green/30";
  }
}

export default function CareHistory() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";

  const { data: pets = [], isLoading: petsLoading } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: careRecords = [], isLoading: recordsLoading } = useRows<any>("care_records", {
    orderBy: "date",
    ascending: false,
  });
  const { data: inventoryItems = [] } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: dbBatches = [] } = useRows<any>("inventory_batches");
  const invalidate = useInvalidate();

  // Multi-medication selection state
  const [medicationsList, setMedicationsList] = useState<
    Array<{
      inventory_item_id: string;
      name: string;
      quantity: number;
      unit: string;
      notes?: string;
    }>
  >([]);

  // Calculate available stock map for validation & label rendering
  const availableStockMap = useMemo(() => {
    const map: Record<string, { totalQty: number; name: string; category: string; unit: string; unitPrice: number }> = {};
    inventoryItems.forEach((item: any) => {
      const itemBatches = dbBatches.filter((b: any) => b.inventory_item_id === item.id);
      const activeBatches = itemBatches.filter((b: any) => {
        const remQty = Number(b.remaining_quantity ?? 0);
        if (remQty <= 0) return false;
        if (!b.expiration_date) return true;
        const expStr = String(b.expiration_date).slice(0, 10);
        return !isBeforeTodayPH(expStr);
      });
      const totalQty = activeBatches.reduce((acc: number, b: any) => acc + Number(b.remaining_quantity ?? 0), 0);
      map[item.id] = {
        totalQty,
        name: item.name,
        category: item.category || "supply",
        unit: item.unit || "unit",
        unitPrice: Number(item.unit_price ?? item.purchase_price ?? 0),
      };
    });
    return map;
  }, [inventoryItems, dbBatches]);

  const handleAddMedicationRow = () => {
    setMedicationsList((prev) => [
      ...prev,
      { inventory_item_id: "", name: "", quantity: 1, unit: "unit", notes: "" },
    ]);
  };

  const handleRemoveMedicationRow = (index: number) => {
    setMedicationsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMedicationItemChange = (index: number, itemId: string) => {
    const targetItem = inventoryItems.find((i: any) => i.id === itemId);
    setMedicationsList((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return {
          ...row,
          inventory_item_id: itemId,
          name: targetItem?.name || "",
          unit: targetItem?.unit || "unit",
        };
      })
    );
  };

  const handleMedicationQtyChange = (index: number, quantity: number) => {
    setMedicationsList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(1, quantity) } : row))
    );
  };

  const handleMedicationNotesChange = (index: number, notes: string) => {
    setMedicationsList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, notes } : row))
    );
  };

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
  const petIdParam = searchParams?.get("petId");
  const openNew = searchParams?.get("new") === "1";
  const [autoOpenedAptId, setAutoOpenedAptId] = useState<string | null>(null);
  const [autoOpenedNew, setAutoOpenedNew] = useState(false);

  useEffect(() => {
    if (!aptId) return;

    const existingRecord = careRecords.find((r: any) => r.appointment_id === aptId);
    if (existingRecord) {
      if (editingId !== existingRecord.id || autoOpenedAptId !== aptId) {
        openEditModal(existingRecord);
        setAutoOpenedAptId(aptId);
      }
      return;
    }

    if (autoOpenedAptId === aptId) return;

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
      setMedicationsList([]);
      setShowEditModal(true);
      setAutoOpenedAptId(aptId);
    }
  }, [aptId, appointments, careRecords, autoOpenedAptId, editingId]);

  useEffect(() => {
    if (petIdParam) setFilterPetId(petIdParam);
  }, [petIdParam]);

  useEffect(() => {
    if (!openNew || autoOpenedNew || aptId) return;
    setEditingId(null);
    resetForm();
    setShowEditModal(true);
    if (petIdParam) {
      setForm((prev) => ({ ...prev, pet_id: petIdParam }));
    }
    setAutoOpenedNew(true);
  }, [openNew, petIdParam, aptId, autoOpenedNew]);

  // Filter logic
  const filteredRecords = careRecords.filter((record) => {
    const pet = petMap.get(record.pet_id);
    const petName = pet?.name || "";
    const ownerName = pet?.owner_id ? ownerMap.get(pet.owner_id) || "" : "";
    const diagnosis = record.diagnosis || "";

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
    if (filterCareType !== "all" && record.record_type !== filterCareType) return false;

    // Vet filter
    if (filterVet !== "all" && (record.vet || "") !== filterVet) return false;

    // Date range filter
    if (startDate && record.date && record.date < startDate) return false;
    if (endDate && record.date && record.date > endDate) return false;

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
    setMedicationsList([]);
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

    let medList: any[] = [];
    if (record.medications_json) {
      try {
        medList = JSON.parse(record.medications_json);
      } catch {
        medList = [];
      }
    }
    if (!medList.length && record.medication) {
      const matchedItem = inventoryItems.find(
        (i: any) => i.name.toLowerCase().trim() === String(record.medication).toLowerCase().trim()
      );
      if (matchedItem) {
        medList = [
          {
            inventory_item_id: matchedItem.id,
            name: matchedItem.name,
            quantity: Number(record.medication_qty) || 1,
            unit: matchedItem.unit || "unit",
          },
        ];
      }
    }
    setMedicationsList(medList);
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

    // Validate medications list
    for (const med of medicationsList) {
      if (!med.inventory_item_id) {
        toast.error("Please select an inventory product for all medication rows.");
        return;
      }
      if (!med.quantity || med.quantity <= 0 || isNaN(med.quantity)) {
        toast.error(`Quantity for "${med.name || "selected product"}" must be greater than zero.`);
        return;
      }
      const stockInfo = availableStockMap[med.inventory_item_id];
      if (!stockInfo || stockInfo.totalQty < med.quantity) {
        toast.error(`Insufficient available stock for ${med.name || "selected item"}.`);
        return;
      }
    }

    // Check duplicate products in the same care record
    const itemIds = medicationsList.map((m) => m.inventory_item_id).filter(Boolean);
    if (new Set(itemIds).size !== itemIds.length) {
      toast.error("Please remove duplicate inventory products from the same care record.");
      return;
    }

    const medSummary = medicationsList.length
      ? medicationsList
          .map((m) => `${m.name} — ${m.quantity} ${m.unit}${m.notes ? ` (${m.notes})` : ""}`)
          .join("; ")
      : form.medication.trim() || null;

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
      medication: medSummary,
      medication_qty: medicationsList.length ? medicationsList.reduce((acc, m) => acc + m.quantity, 0) : Number(form.medication_qty) || 1,
      medications_json: medicationsList.length ? JSON.stringify(medicationsList) : null,
      vaccine_used: form.vaccine_used.trim() || null,
      next_vax_due: form.next_vax_due || null,
      dewormer_used: form.dewormer_used.trim() || null,
      next_deworming_due: form.next_deworming_due || null,
      outcome: form.outcome.trim() || null,
      notes: form.notes.trim() || null,
    };

    let targetId = editingId;
    if (!targetId && form.appointment_id) {
      const existing = careRecords.find((r: any) => r.appointment_id === form.appointment_id);
      if (existing) {
        targetId = existing.id;
      }
    }

    let savedRecord: any = null;
    let error: any = null;

    if (targetId) {
      const res = await db.from("care_records").update(payload as any).eq("id", targetId);
      error = res.error;
    } else {
      const res = await db.from("care_records").insert(payload as any).select("id").single();
      savedRecord = res.data;
      error = res.error;
    }

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    const careRecordId = (savedRecord as any)?.id || targetId;
    const petObj = petMap.get(form.pet_id);
    const petName = petObj?.name || "Pet";
    const ownerId = petObj?.owner_id || null;
    const staffName = user?.user_metadata?.full_name || user?.email || form.vet || "Clinic Staff";

    await processPrescribedMedications({
      medicationsList,
      availableStockMap,
      dbBatches,
      petId: form.pet_id,
      petName,
      ownerId,
      careRecordId,
      recordDate: form.date,
      recordType: form.record_type,
      staffName,
    });

    if ((form.record_type === "vaccination" || form.vaccine_used.trim()) && form.vaccine_used.trim()) {
      await db.from("vaccinations").insert({
        pet_id: form.pet_id,
        vaccine_type: form.vaccine_used.trim(),
        date_given: form.date,
        next_due: form.next_vax_due || null,
        vet: form.vet,
        notes: form.notes || null,
        skip_stock_deduction: true,
      } as any);
    }

    if ((form.record_type === "deworming" || form.dewormer_used.trim()) && form.dewormer_used.trim()) {
      await db.from("dewormings").insert({
        pet_id: form.pet_id,
        product: form.dewormer_used.trim(),
        date_given: form.date,
        next_due: form.next_deworming_due || null,
        vet: form.vet,
        status: "Completed",
        notes: form.notes || null,
        skip_stock_deduction: true,
      } as any);
    }

    setSaving(false);

    toast.success(targetId ? "Care History record updated." : "Care History record saved successfully.");
    setShowEditModal(false);
    setEditingId(null);
    resetForm();
    invalidate("care_records");
    invalidate("vaccinations");
    invalidate("dewormings");
    invalidate("inventory_items");
    invalidate("inventory_batches");
    invalidate("inventory_transactions");
    invalidate("lab_transactions");
    invalidate("lab_transaction_items");
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

    const bodyHtml = `
      <div class="header-brand">
        <img src="/logo.png" style="height:44px;width:44px;object-fit:contain;border-radius:6px;" alt="HVS" />
        <div>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Care History & Medical Records</h2>
        </div>
      </div>
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
      <div class="footer-brand">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic Management System</div>
    `;

    printDocument({
      title: "Harbourside Veterinary Clinic - Care History Report",
      bodyHtml,
    });
  };

  const selectedPetObject = petMap.get(form.pet_id);
  const selectedPetOwnerName = selectedPetObject?.owner_id ? ownerMap.get(selectedPetObject.owner_id) || "Unassigned" : "Unassigned";

  if (petsLoading || recordsLoading) {
    return <PageSkeleton rows={8} />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Care History"
        description="Unified medical records for check-ups, vaccinations, treatments, and dewormings"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handlePrint()}>
              <Printer className="h-4 w-4 mr-1.5" /> Print Records
            </Button>
            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Care Record
            </Button>
          </div>
        }
      />

      {/* Filter and Search Card */}
      <Card>
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
              <TableRow className="bg-[#E8EEF4] hover:bg-[#E8EEF4]">
                <TableHead className="text-[#1B3A5C] font-bold text-xs">Visit Date</TableHead>
                <TableHead className="text-[#1B3A5C] font-bold text-xs">Pet</TableHead>
                <TableHead className="text-[#1B3A5C] font-bold text-xs">Owner</TableHead>
                <TableHead className="text-[#1B3A5C] font-bold text-xs">Care Type</TableHead>
                <TableHead className="text-[#1B3A5C] font-bold text-xs">Veterinarian / Staff</TableHead>
                <TableHead className="text-[#1B3A5C] font-bold text-xs">Status / Details</TableHead>
                <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">Actions</TableHead>
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

                          {pet?.owner_id && (
                            <Link
                              href={`/admin/messages?ownerId=${pet.owner_id}&petId=${r.pet_id}&type=${
                                String(r.record_type).toLowerCase().includes("vax") || String(r.record_type).toLowerCase().includes("vaccin")
                                  ? "Vaccination+Reminder"
                                  : String(r.record_type).toLowerCase().includes("deworm")
                                  ? "Deworming+Reminder"
                                  : "Custom+Message"
                              }`}
                            >
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-[#1FA8A8] hover:text-[#198a8a] hover:bg-[#E8F6F6]"
                                title="Send Care Reminder"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          )}
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

            {/* Medication & Inventory Products Section */}
            <div className="space-y-3 p-4 bg-brand-navy-light/40 rounded-lg border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-navy">
                    Medication / Product Used
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Select products used from inventory. Quantities will be automatically deducted using FEFO.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMedicationRow}
                  className="h-7 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Another Product
                </Button>
              </div>

              {medicationsList.length > 0 ? (
                <div className="space-y-2.5">
                  {medicationsList.map((row, idx) => {
                    const stockInfo = availableStockMap[row.inventory_item_id] || {
                      totalQty: 0,
                      unit: row.unit || "unit",
                      unitPrice: 0,
                    };
                    const lineTotal = (stockInfo.unitPrice || 0) * (row.quantity || 0);
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-card p-3 rounded-lg border border-border/60 text-xs">
                        <div className="col-span-12 sm:col-span-5 space-y-1">
                          <Label className="text-[11px]">
                            Product / Medication <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={row.inventory_item_id}
                            onValueChange={(val) => handleMedicationItemChange(idx, val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select inventory product" />
                            </SelectTrigger>
                            <SelectContent className="max-h-56">
                              {inventoryItems.map((item: any) => {
                                const info = availableStockMap[item.id] || { totalQty: 0, unit: "unit", category: "supply" };
                                return (
                                  <SelectItem key={item.id} value={item.id}>
                                    {item.name} ({info.category}) — Available: {info.totalQty} {info.unit}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-4 sm:col-span-2 space-y-1">
                          <Label className="text-[11px]">Quantity *</Label>
                          <Input
                            type="number"
                            min={1}
                            className="h-8 text-xs"
                            value={row.quantity}
                            onChange={(e) => handleMedicationQtyChange(idx, parseInt(e.target.value, 10) || 1)}
                          />
                        </div>

                        <div className="col-span-8 sm:col-span-4 space-y-1">
                          <Label className="text-[11px]">Instructions / Notes</Label>
                          <Input
                            className="h-8 text-xs"
                            value={row.notes || ""}
                            onChange={(e) => handleMedicationNotesChange(idx, e.target.value)}
                            placeholder="e.g. 2 tabs twice daily..."
                          />
                        </div>

                        <div className="col-span-11 sm:col-span-1 flex justify-end pb-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveMedicationRow(idx)}
                            title="Remove medication"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {row.inventory_item_id ? (
                          <div className="col-span-12 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                            <span>Available: <strong className="text-foreground">{stockInfo.totalQty} {stockInfo.unit}</strong></span>
                            <span>Unit Price: <strong className="text-foreground">₱{Number(stockInfo.unitPrice || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                            <span>Total: <strong className="text-brand-navy">₱{lineTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 border border-dashed rounded-lg text-xs text-muted-foreground bg-card/50">
                  No inventory products added to this care record yet.
                </div>
              )}
            </div>

            {/* Vaccination Specific Fields */}
            {(form.record_type === "vaccination" || form.record_type === "vaccine") && (
              <div className="space-y-4 p-3 bg-brand-navy-light/50 rounded-lg border border-brand-navy/15">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-navy border-b border-brand-navy/15 pb-1">
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

                {(() => {
                  let medItems: any[] = [];
                  if (selectedRecord.medications_json) {
                    try {
                      medItems = JSON.parse(selectedRecord.medications_json);
                    } catch {
                      medItems = [];
                    }
                  }
                  if (!medItems.length && selectedRecord.medication) {
                    medItems = [
                      {
                        name: selectedRecord.medication,
                        quantity: selectedRecord.medication_qty || 1,
                        unit: "unit",
                      },
                    ];
                  }

                  if (!medItems.length) return null;

                  return (
                    <div className="space-y-1.5 border-t pt-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Medication & Inventory Products Used
                      </h4>
                      <div className="rounded-md border p-2 bg-muted/20 space-y-1.5 text-xs">
                        {medItems.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                            <div>
                              <span className="font-semibold text-foreground">{m.name}</span>
                              {m.notes && <span className="text-muted-foreground text-[11px] block">{m.notes}</span>}
                            </div>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {m.quantity} {m.unit || "unit"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
