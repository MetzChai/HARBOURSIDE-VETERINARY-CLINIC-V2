"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PawPrint,
  Pencil,
  Plus,
  Printer,
  Search,
  Users,
  Loader2,
  Filter,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Syringe,
  FileText,
  AlertTriangle,
  Stethoscope,
  CheckCircle2,
  Bug,
  Package,
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import PetCareHistoryTimeline from "@/components/PetCareHistoryTimeline";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatAge, formatDate } from "@/lib/age";
import { formatNowPH, todayPH, isBeforeTodayPH } from "@/lib/datetime";
import { VET_OPTIONS } from "@/lib/appointment-slots";
import { useAuth } from "@/hooks/useAuth";
import { processPrescribedMedications } from "@/lib/careHistoryStock";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

type PetRow = {
  id: string;
  pet_code?: string | null;
  owner_id: string;
  name: string;
  species?: string | null;
  breed?: string | null;
  gender?: string | null;
  dob?: string | null;
  estimated_age?: string | null;
  color?: string | null;
  weight?: string | null;
  microchip_number?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  existing_conditions?: string | null;
  notes?: string | null;
  image_url?: string | null;
  status?: string | null;
  health_status?: string | null;
  cause_of_death?: string | null;
  deceased_date?: string | null;
  owners?: { name: string; contact?: string; email?: string } | null;
};

const ITEMS_PER_PAGE = 8;
const SPECIES_OPTIONS = ["Dog", "Cat", "Bird", "Rabbit", "Reptile", "Other"];
const STATUS_OPTIONS = ["Healthy", "Under Treatment", "Recovered", "Deceased"];

export default function ManagePets() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";

  const { data: pets = [], isLoading } = useRows<PetRow>("pets", { orderBy: "created_at", ascending: false });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: careRecords = [] } = useRows<any>("care_records", { orderBy: "date", ascending: false });
  const { data: vaccinations = [] } = useRows<any>("vaccinations", { orderBy: "date_given", ascending: false });
  const { data: dewormings = [] } = useRows<any>("dewormings", { orderBy: "date_given", ascending: false });
  const { data: inventoryItems = [] } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: dbBatches = [] } = useRows<any>("inventory_batches");

  const invalidate = useInvalidate();

  // Stock Map for Inventory Validation
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

  // Search, Filter & Pagination
  const [search, setSearch] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOwnerId, setFilterOwnerId] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [viewPet, setViewPet] = useState<PetRow | null>(null);
  const [profileTab, setProfileTab] = useState("info");
  const [showAdd, setShowAdd] = useState(false);
  const [editPet, setEditPet] = useState<PetRow | null>(null);
  const [deletePetTarget, setDeletePetTarget] = useState<PetRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Record Form Modal State
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [savingRecord, setSavingRecord] = useState(false);

  const emptyRecordForm = {
    record_type: "checkup" as "checkup" | "vaccination" | "treatment" | "deworming",
    date: todayPH(),
    vet: VET_OPTIONS[0] || "Alfredo B. Badiola, Jr., DVM",
    chief_complaint: "",
    symptoms: "",
    diagnosis: "",
    findings: "",
    treatment: "",
    medication: "",
    vaccine_used: "",
    next_vax_due: "",
    dewormer_used: "",
    next_deworming_due: "",
    outcome: "Completed",
    notes: "",
  };

  const [recordForm, setRecordForm] = useState(emptyRecordForm);
  const [medicationsList, setMedicationsList] = useState<
    Array<{
      inventory_item_id: string;
      name: string;
      quantity: number;
      unit: string;
      notes?: string;
    }>
  >([]);

  // Form State for Pet Creation/Edit
  const emptyForm = {
    pet_code: "",
    owner_id: "",
    name: "",
    species: "Dog",
    breed: "",
    gender: "Male",
    dob: "",
    estimated_age: "",
    color: "",
    weight: "",
    microchip_number: "",
    blood_type: "",
    allergies: "",
    existing_conditions: "",
    notes: "",
    image_url: "",
    status: "Healthy",
    cause_of_death: "",
    deceased_date: "",
  };

  const [form, setForm] = useState(emptyForm);

  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);

  const openAdd = () => {
    setForm({
      ...emptyForm,
      pet_code: `PET-${Date.now().toString().slice(-6)}`,
      owner_id: owners[0]?.id || "",
    });
    setShowAdd(true);
  };

  const openEdit = (pet: PetRow) => {
    setEditPet(pet);
    setForm({
      pet_code: pet.pet_code || `PET-${pet.id.slice(0, 6)}`,
      owner_id: pet.owner_id,
      name: pet.name,
      species: pet.species || "Dog",
      breed: pet.breed || "",
      gender: pet.gender || "Male",
      dob: pet.dob || "",
      estimated_age: pet.estimated_age || "",
      color: pet.color || "",
      weight: pet.weight || "",
      microchip_number: pet.microchip_number || "",
      blood_type: pet.blood_type || "",
      allergies: pet.allergies || "",
      existing_conditions: pet.existing_conditions || "",
      notes: pet.notes || "",
      image_url: pet.image_url || "",
      status: pet.health_status || (pet.status === "deceased" ? "Deceased" : "Healthy"),
      cause_of_death: pet.cause_of_death || "",
      deceased_date: pet.deceased_date || "",
    });
  };

  const openAddRecordModal = (type: "checkup" | "vaccination" | "treatment" | "deworming" = "checkup") => {
    setEditingRecordId(null);
    setRecordForm({
      ...emptyRecordForm,
      record_type: type,
      date: todayPH(),
      vet: VET_OPTIONS[0] || "Alfredo B. Badiola, Jr., DVM",
    });
    setMedicationsList([]);
    setShowRecordModal(true);
  };

  const openEditRecordModal = (record: any) => {
    setEditingRecordId(record.id);
    const recType = String(record.record_type || record.type || "checkup").toLowerCase();
    const normType = (recType === "vaccine" ? "vaccination" : recType) as any;
    setRecordForm({
      record_type: normType,
      date: record.date ? String(record.date).slice(0, 10) : record.date_given ? String(record.date_given).slice(0, 10) : todayPH(),
      vet: record.vet || VET_OPTIONS[0] || "",
      chief_complaint: record.chief_complaint || "",
      symptoms: record.symptoms || "",
      diagnosis: record.diagnosis || "",
      findings: record.findings || "",
      treatment: record.treatment || "",
      medication: record.medication || "",
      vaccine_used: record.vaccine_used || record.vaccine_type || "",
      next_vax_due: record.next_vax_due ? String(record.next_vax_due).slice(0, 10) : record.next_due ? String(record.next_due).slice(0, 10) : "",
      dewormer_used: record.dewormer_used || record.product || "",
      next_deworming_due: record.next_deworming_due ? String(record.next_deworming_due).slice(0, 10) : record.next_due ? String(record.next_due).slice(0, 10) : "",
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
    setShowRecordModal(true);
  };

  const handleSaveRecord = async () => {
    if (!viewPet) return;
    if (!recordForm.date || !recordForm.vet.trim()) {
      toast.error("Visit date and veterinarian/staff are required.");
      return;
    }

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

    const itemIds = medicationsList.map((m) => m.inventory_item_id).filter(Boolean);
    if (new Set(itemIds).size !== itemIds.length) {
      toast.error("Please remove duplicate inventory products from the same care record.");
      return;
    }

    const medSummary = medicationsList.length
      ? medicationsList
          .map((m) => `${m.name} — ${m.quantity} ${m.unit}${m.notes ? ` (${m.notes})` : ""}`)
          .join("; ")
      : recordForm.medication.trim() || null;

    setSavingRecord(true);

    const payload = {
      pet_id: viewPet.id,
      date: recordForm.date,
      vet: recordForm.vet,
      record_type: recordForm.record_type,
      chief_complaint: recordForm.chief_complaint.trim() || null,
      symptoms: recordForm.symptoms.trim() || null,
      diagnosis: recordForm.diagnosis.trim() || null,
      findings: recordForm.findings.trim() || null,
      treatment: recordForm.treatment.trim() || null,
      medication: medSummary,
      medication_qty: medicationsList.length ? medicationsList.reduce((acc, m) => acc + m.quantity, 0) : 1,
      medications_json: medicationsList.length ? JSON.stringify(medicationsList) : null,
      vaccine_used: recordForm.record_type === "vaccination" ? recordForm.vaccine_used.trim() || null : null,
      next_vax_due: recordForm.record_type === "vaccination" ? recordForm.next_vax_due || null : null,
      dewormer_used: recordForm.record_type === "deworming" ? recordForm.dewormer_used.trim() || null : null,
      next_deworming_due: recordForm.record_type === "deworming" ? recordForm.next_deworming_due || null : null,
      outcome: recordForm.outcome.trim() || null,
      notes: recordForm.notes.trim() || null,
    };

    let savedRecord: any = null;
    let error: any = null;

    if (editingRecordId) {
      const res = await db.from("care_records").update(payload as any).eq("id", editingRecordId);
      error = res.error;
    } else {
      const res = await db.from("care_records").insert(payload as any).select("id").single();
      savedRecord = res.data;
      error = res.error;
    }

    if (error) {
      setSavingRecord(false);
      toast.error(error.message);
      return;
    }

    const careRecordId = (savedRecord as any)?.id || editingRecordId;
    const staffName = user?.user_metadata?.full_name || user?.email || recordForm.vet || "Clinic Staff";

    await processPrescribedMedications({
      medicationsList,
      availableStockMap,
      dbBatches,
      petId: viewPet.id,
      petName: viewPet.name,
      ownerId: viewPet.owner_id || null,
      careRecordId,
      recordDate: recordForm.date,
      recordType: recordForm.record_type,
      staffName,
    });

    if (recordForm.record_type === "vaccination" && recordForm.vaccine_used.trim()) {
      await db.from("vaccinations").insert({
        pet_id: viewPet.id,
        vaccine_type: recordForm.vaccine_used.trim(),
        date_given: recordForm.date,
        next_due: recordForm.next_vax_due || null,
        vet: recordForm.vet,
        notes: recordForm.notes || null,
        skip_stock_deduction: true,
      } as any);
    }

    if (recordForm.record_type === "deworming" && recordForm.dewormer_used.trim()) {
      await db.from("dewormings").insert({
        pet_id: viewPet.id,
        product: recordForm.dewormer_used.trim(),
        date_given: recordForm.date,
        next_due: recordForm.next_deworming_due || null,
        vet: recordForm.vet,
        status: "Completed",
        notes: recordForm.notes || null,
        skip_stock_deduction: true,
      } as any);
    }

    setSavingRecord(false);
    toast.success(
      editingRecordId
        ? "Medical record updated successfully."
        : `${recordForm.record_type.toUpperCase()} record saved to Care History.`
    );

    setShowRecordModal(false);
    invalidate("care_records");
    invalidate("vaccinations");
    invalidate("dewormings");
    invalidate("inventory_items");
    invalidate("inventory_batches");
    invalidate("inventory_transactions");
    invalidate("lab_transactions");
    invalidate("lab_transaction_items");
  };

  const handleSavePet = async () => {
    if (!form.name.trim() || !form.owner_id) {
      toast.error("Pet name and owner are required.");
      return;
    }

    setSaving(true);
    const code = form.pet_code || `PET-${Date.now().toString().slice(-6)}`;

    const payload = {
      pet_code: code,
      owner_id: form.owner_id,
      name: form.name.trim(),
      species: form.species,
      breed: form.breed.trim() || null,
      gender: form.gender,
      dob: form.dob || null,
      estimated_age: form.estimated_age.trim() || null,
      color: form.color.trim() || null,
      weight: form.weight.trim() || null,
      microchip_number: form.microchip_number.trim() || null,
      blood_type: form.blood_type.trim() || null,
      allergies: form.allergies.trim() || null,
      existing_conditions: form.existing_conditions.trim() || null,
      notes: form.notes.trim() || null,
      image_url: form.image_url || null,
      health_status: form.status,
      status: form.status === "Deceased" ? "deceased" : "available",
      cause_of_death: form.status === "Deceased" ? form.cause_of_death.trim() || null : null,
      deceased_date: form.status === "Deceased" ? form.deceased_date || todayPH() : null,
    };

    const { error } = editPet
      ? await db.from("pets").update(payload as any).eq("id", editPet.id)
      : await db.from("pets").insert(payload as any);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editPet ? `${form.name} updated successfully.` : `${form.name} registered successfully.`);
    setShowAdd(false);
    setEditPet(null);
    setForm(emptyForm);
    invalidate("pets");
  };

  const handleDeletePet = async () => {
    if (!deletePetTarget || !isAdmin) return;

    setSaving(true);
    const { error } = await db.from("pets").delete().eq("id", deletePetTarget.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Pet record for ${deletePetTarget.name} deleted.`);
    setDeletePetTarget(null);
    invalidate("pets");
  };

  // Filter & Search Logic
  const filteredPets = useMemo(() => {
    return pets.filter((p) => {
      const q = search.toLowerCase().trim();
      const codeStr = (p.pet_code || "").toLowerCase();
      const petNameStr = p.name.toLowerCase();
      const ownerNameStr = (p.owners?.name || ownerMap.get(p.owner_id)?.name || "").toLowerCase();
      const speciesStr = (p.species || "").toLowerCase();
      const breedStr = (p.breed || "").toLowerCase();

      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q) && !speciesStr.includes(q) && !breedStr.includes(q)) {
        return false;
      }

      if (filterSpecies !== "all" && speciesStr !== filterSpecies.toLowerCase()) return false;
      if (filterStatus !== "all" && (p.health_status || p.status || "Healthy").toLowerCase().replace(/\s+/g, "_") !== filterStatus.toLowerCase().replace(/\s+/g, "_")) return false;
      if (filterOwnerId !== "all" && p.owner_id !== filterOwnerId) return false;

      return true;
    });
  }, [pets, search, filterSpecies, filterStatus, filterOwnerId, ownerMap]);

  // Pagination
  const totalPages = Math.ceil(filteredPets.length / ITEMS_PER_PAGE) || 1;
  const paginatedPets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPets, currentPage]);

  const petAppointments = (petId: string) => appointments.filter((a) => a.pet_id === petId);
  const petVaccinations = (petId: string) => vaccinations.filter((v) => v.pet_id === petId);
  const petDewormings = (petId: string) => dewormings.filter((d) => d.pet_id === petId);
  const petTreatments = (petId: string) => careRecords.filter((c) => c.pet_id === petId && String(c.record_type || "").toLowerCase() === "treatment");
  const petCheckups = (petId: string) => careRecords.filter((c) => c.pet_id === petId && (String(c.record_type || "").toLowerCase() === "checkup" || String(c.record_type || "").toLowerCase() === "check-up" || !c.record_type));

  const getPetStatusBadge = (status?: string | null) => {
    const s = (status ?? "Healthy").toLowerCase();
    switch (s) {
      case "under_treatment":
      case "under treatment":
        return <Badge className="bg-amber-500 text-white">Under Treatment</Badge>;
      case "recovered":
        return <Badge className="bg-brand-teal text-white">Recovered</Badge>;
      case "deceased":
        return <Badge variant="destructive">Deceased</Badge>;
      default:
        return <Badge className="bg-brand-green text-white">Healthy</Badge>;
    }
  };

  const handlePrintPetProfile = (pet: PetRow) => {
    const owner = ownerMap.get(pet.owner_id) || pet.owners;
    const checkupList = petCheckups(pet.id);
    const vaxList = petVaccinations(pet.id);
    const treatList = petTreatments(pet.id);
    const dewormList = petDewormings(pet.id);

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <head>
          <title>Pet Medical Record - ${pet.name}</title>
          <style>
            @page { size: portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; padding: 20px; color: #222; background: #fff; line-height: 1.4; }
            .header-banner { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1B3A5C; padding-bottom: 12px; margin-bottom: 20px; }
            h1 { color: #1B3A5C; margin: 0; font-size: 24px; font-weight: bold; }
            h2 { color: #555; margin: 4px 0 0 0; font-size: 14px; font-weight: normal; }
            .badge { background: #1B3A5C; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; font-family: monospace; }
            .section-title { color: #1B3A5C; font-size: 15px; font-weight: bold; border-bottom: 2px solid #E8EEF4; padding-bottom: 6px; margin-top: 24px; margin-bottom: 10px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px; }
            .info-item { display: flex; flex-direction: column; }
            .info-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .info-val { font-size: 12px; color: #0f172a; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #E8EEF4; color: #1B3A5C; font-weight: bold; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <div>
              <h1>Harbourside Veterinary Clinic</h1>
              <h2>Official Pet Medical Profile</h2>
            </div>
            <div>
              <span class="badge">${pet.pet_code || "PET"}</span>
            </div>
          </div>
          
          <div class="info-grid">
            <div class="info-item"><span class="info-label">Pet Name</span><span class="info-val">${pet.name} (${pet.gender || "—"})</span></div>
            <div class="info-item"><span class="info-label">Owner Name</span><span class="info-val">${owner?.name || "—"}</span></div>
            <div class="info-item"><span class="info-label">Species & Breed</span><span class="info-val">${pet.species || "—"} (${pet.breed || "Crossbreed"})</span></div>
            <div class="info-item"><span class="info-label">Owner Contact & Email</span><span class="info-val">${owner?.contact || "—"} | ${owner?.email || "—"}</span></div>
            <div class="info-item"><span class="info-label">Age / DOB</span><span class="info-val">${pet.dob ? formatDate(pet.dob) : pet.estimated_age || "—"}</span></div>
            <div class="info-item"><span class="info-label">Owner Address</span><span class="info-val">${owner?.address || "—"}</span></div>
            <div class="info-item"><span class="info-label">Weight & Color</span><span class="info-val">${pet.weight || "—"} | ${pet.color || "—"}</span></div>
            <div class="info-item"><span class="info-label">Microchip # & Blood Type</span><span class="info-val">${pet.microchip_number || "None"} | ${pet.blood_type || "—"}</span></div>
            <div class="info-item"><span class="info-label">Current Health Status</span><span class="info-val">${pet.health_status || pet.status || "Healthy"}</span></div>
            <div class="info-item"><span class="info-label">Allergies & Existing Conditions</span><span class="info-val">Allergies: ${pet.allergies || "None"} | Conditions: ${pet.existing_conditions || "None"}</span></div>
          </div>

          <div class="section-title">Check-up & Exam Records (${checkupList.length})</div>
          <table>
            <thead><tr><th>Date</th><th>Chief Complaint</th><th>Diagnosis</th><th>Clinical Findings</th><th>Medications / Products</th><th>Veterinarian</th></tr></thead>
            <tbody>
              ${
                checkupList
                  .map(
                    (c) =>
                      `<tr><td>${c.date ? formatDate(c.date) : "—"}</td><td>${c.chief_complaint || "—"}</td><td>${c.diagnosis || "General Exam"}</td><td>${c.findings || "—"}</td><td>${c.medication || "—"}</td><td>${c.vet || "Clinic Staff"}</td></tr>`
                  )
                  .join("") || "<tr><td colSpan='6'>No check-up records logged</td></tr>"
              }
            </tbody>
          </table>

          <div class="section-title">Vaccination Records (${vaxList.length})</div>
          <table>
            <thead><tr><th>Vaccine</th><th>Date Given</th><th>Next Due</th><th>Veterinarian</th><th>Notes</th></tr></thead>
            <tbody>
              ${
                vaxList
                  .map(
                    (v) =>
                      `<tr><td>${v.vaccine_type}</td><td>${v.date_given ? formatDate(v.date_given) : "—"}</td><td>${v.next_due ? formatDate(v.next_due) : "—"}</td><td>${v.vet || "Clinic Staff"}</td><td>${v.notes || "—"}</td></tr>`
                  )
                  .join("") || "<tr><td colSpan='5'>No vaccination records logged</td></tr>"
              }
            </tbody>
          </table>

          <div class="section-title">Treatment Records (${treatList.length})</div>
          <table>
            <thead><tr><th>Date</th><th>Chief Complaint</th><th>Diagnosis</th><th>Treatment / Procedure</th><th>Veterinarian</th></tr></thead>
            <tbody>
              ${
                treatList
                  .map(
                    (t) =>
                      `<tr><td>${t.date ? formatDate(t.date) : "—"}</td><td>${t.chief_complaint || "—"}</td><td>${t.diagnosis || "—"}</td><td>${t.treatment || "—"}</td><td>${t.vet || "Clinic Staff"}</td></tr>`
                  )
                  .join("") || "<tr><td colSpan='5'>No treatment records logged</td></tr>"
              }
            </tbody>
          </table>

          <div class="section-title">Deworming Records (${dewormList.length})</div>
          <table>
            <thead><tr><th>Product</th><th>Date Given</th><th>Next Due</th><th>Status</th><th>Veterinarian</th></tr></thead>
            <tbody>
              ${
                dewormList
                  .map(
                    (d) =>
                      `<tr><td>${d.product || d.dewormer_used || "Deworming"}</td><td>${d.date_given ? formatDate(d.date_given) : d.date ? formatDate(d.date) : "—"}</td><td>${d.next_due ? formatDate(d.next_due) : d.next_deworming_due ? formatDate(d.next_deworming_due) : "—"}</td><td>${d.status || "Completed"}</td><td>${d.vet || "Clinic Staff"}</td></tr>`
                  )
                  .join("") || "<tr><td colSpan='5'>No deworming records logged</td></tr>"
              }
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
    return <PageSkeleton rows={8} />;
  }

  return (
    <div className="page-container pb-10">
      <PageHeader
        title="Manage Pets"
        description="Register pets, manage medical profiles, status tracking, and care timelines"
        actions={
          <Button onClick={openAdd} disabled={owners.length === 0}>
            <Plus className="h-4 w-4 mr-1.5" /> Register Pet
          </Button>
        }
      />

      {/* Filter & Search Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Search Pets</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Pet Name, Owner Name, Species, Breed, or Code..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Species</Label>
              <Select
                value={filterSpecies}
                onValueChange={(v) => {
                  setFilterSpecies(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Species" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Species</SelectItem>
                  {SPECIES_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s.toLowerCase()}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Current Health Status</Label>
              <Select
                value={filterStatus}
                onValueChange={(v) => {
                  setFilterStatus(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s.toLowerCase()}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pets Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#E8EEF4] hover:bg-[#E8EEF4]">
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Pet Code</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Pet</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Owner</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Species & Breed</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Gender / Age</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Health Status</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPets.length ? (
                    paginatedPets.map((pet) => (
                      <TableRow key={pet.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {pet.pet_code || `PET-${pet.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={pet.image_url ?? undefined} alt={pet.name} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {pet.name[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-foreground">{pet.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{pet.owners?.name || ownerMap.get(pet.owner_id)?.name || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {pet.species || "—"} ({pet.breed || "Crossbreed"})
                        </TableCell>
                        <TableCell className="text-xs">
                          {pet.gender || "—"} • {pet.dob ? formatAge(pet.dob) : pet.estimated_age || "—"}
                        </TableCell>
                        <TableCell>{getPetStatusBadge(pet.health_status || pet.status)}</TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setViewPet(pet)}
                              title="View Pet Profile & Medical History"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEdit(pet)}
                              title="Edit Pet"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handlePrintPetProfile(pet)}
                              title="Print Pet Profile"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => setDeletePetTarget(pet)}
                                title="Delete Pet"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        No pet records found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {filteredPets.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredPets.length)} of {filteredPets.length} pets
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                  </Button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Pet Dialog */}
      <Dialog
        open={showAdd || !!editPet}
        onOpenChange={(o) => {
          if (!o) {
            setShowAdd(false);
            setEditPet(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-heading">{editPet ? "Edit Pet Information" : "Register New Pet"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 max-h-[500px] overflow-y-auto pr-1">
            <div className="flex justify-center">
              <ImageUpload
                currentImage={form.image_url}
                fallback={form.name ? form.name[0] : "?"}
                folder="pets"
                size="lg"
                onImageUploaded={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pet Name *</Label>
                <Input
                  placeholder="e.g. Buddy, Mimi"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Owner *</Label>
                <Select value={form.owner_id} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} ({o.owner_code || "OWN"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Species</Label>
                <Select value={form.species} onValueChange={(v) => setForm({ ...form, species: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIES_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Breed</Label>
                <Input
                  placeholder="e.g. Golden Retriever, Siamese"
                  value={form.breed}
                  onChange={(e) => setForm({ ...form, breed: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Sex / Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Birth Date</Label>
                <Input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Estimated Age</Label>
                <Input
                  placeholder="e.g. 2 yrs, 6 mos"
                  value={form.estimated_age}
                  onChange={(e) => setForm({ ...form, estimated_age: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Weight</Label>
                <Input
                  placeholder="e.g. 12 kg, 4.5 lbs"
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Color / Markings</Label>
                <Input
                  placeholder="e.g. Brown & White"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Microchip Number</Label>
                <Input
                  placeholder="e.g. 982000318291"
                  value={form.microchip_number}
                  onChange={(e) => setForm({ ...form, microchip_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Blood Type</Label>
                <Input
                  placeholder="e.g. DEA 1.1, Type A"
                  value={form.blood_type}
                  onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Health Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Allergies</Label>
              <Input
                placeholder="e.g. Penicillin, Chicken protein"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Existing Conditions</Label>
              <Input
                placeholder="e.g. Asthma, Hip dysplasia"
                value={form.existing_conditions}
                onChange={(e) => setForm({ ...form, existing_conditions: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes / Special Care</Label>
              <Textarea
                placeholder="Special diet or temperament notes..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            {form.status === "Deceased" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded bg-rose-50 border border-rose-200">
                <div className="space-y-1">
                  <Label className="text-xs text-rose-800">Cause of Death</Label>
                  <Input
                    placeholder="e.g. Severe organ failure"
                    value={form.cause_of_death}
                    onChange={(e) => setForm({ ...form, cause_of_death: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-rose-800">Deceased Date</Label>
                  <Input
                    type="date"
                    value={form.deceased_date}
                    onChange={(e) => setForm({ ...form, deceased_date: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditPet(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSavePet} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editPet ? "Save Changes" : "Save Pet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Pet Profile Modal */}
      <Dialog
        open={!!viewPet}
        onOpenChange={(open) => {
          if (!open) {
            setViewPet(null);
            setProfileTab("info");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewPet && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
                    <PawPrint className="h-5 w-5 text-primary" /> {viewPet.name}'s Medical Profile
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {viewPet.pet_code || `PET-${viewPet.id.slice(0, 6)}`}
                    </Badge>
                    {getPetStatusBadge(viewPet.status)}
                  </div>
                </div>
              </DialogHeader>

              <Tabs value={profileTab} onValueChange={setProfileTab} className="space-y-4 pt-2">
                <TabsList className="bg-muted p-1 grid grid-cols-6 w-full">
                  <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs">Care History</TabsTrigger>
                  <TabsTrigger value="checkups" className="text-xs">Check-ups ({petCheckups(viewPet.id).length})</TabsTrigger>
                  <TabsTrigger value="vaccinations" className="text-xs">Vaccines ({petVaccinations(viewPet.id).length})</TabsTrigger>
                  <TabsTrigger value="treatments" className="text-xs">Treatments ({petTreatments(viewPet.id).length})</TabsTrigger>
                  <TabsTrigger value="dewormings" className="text-xs">Dewormings ({petDewormings(viewPet.id).length})</TabsTrigger>
                </TabsList>

                {/* Tab 1: Pet & Owner Info */}
                <TabsContent value="info" className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/schedule?petId=${viewPet.id}&new=1`}>
                        <Calendar className="h-4 w-4 mr-1.5" /> Schedule Appointment
                      </Link>
                    </Button>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl border bg-card">
                    <Avatar className="h-20 w-20">
                      <AvatarImage src={viewPet.image_url ?? undefined} alt={viewPet.name} />
                      <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                        {viewPet.name[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="grid grid-cols-2 gap-3 text-sm flex-1">
                      <div><span className="text-muted-foreground text-xs block">Species & Breed</span> {viewPet.species || "—"} ({viewPet.breed || "Crossbreed"})</div>
                      <div><span className="text-muted-foreground text-xs block">Owner</span> {viewPet.owners?.name || ownerMap.get(viewPet.owner_id)?.name || "—"}</div>
                      <div><span className="text-muted-foreground text-xs block">Gender & Age</span> {viewPet.gender || "—"} • {viewPet.dob ? formatAge(viewPet.dob) : viewPet.estimated_age || "—"}</div>
                      <div><span className="text-muted-foreground text-xs block">Weight & Color</span> {viewPet.weight || "—"} | {viewPet.color || "—"}</div>
                      <div><span className="text-muted-foreground text-xs block">Microchip #</span> {viewPet.microchip_number || "—"}</div>
                      <div><span className="text-muted-foreground text-xs block">Blood Type</span> {viewPet.blood_type || "—"}</div>
                      <div><span className="text-muted-foreground text-xs block">Allergies</span> {viewPet.allergies || "None"}</div>
                      <div><span className="text-muted-foreground text-xs block">Existing Conditions</span> {viewPet.existing_conditions || "None"}</div>
                    </div>
                  </div>

                  {viewPet.notes && (
                    <div className="p-3 rounded-lg border bg-muted/40 text-xs">
                      <span className="font-semibold block uppercase text-muted-foreground">Notes</span>
                      <p>{viewPet.notes}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab 2: Care History Timeline */}
                <TabsContent value="timeline" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-xs font-semibold text-muted-foreground">Care History Medical Timeline</span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto pr-1">
                    <PetCareHistoryTimeline petId={viewPet.id} />
                  </div>
                </TabsContent>

                {/* Tab: Check-ups */}
                <TabsContent value="checkups" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-xs font-semibold text-muted-foreground">Check-up & Exam Records ({petCheckups(viewPet.id).length})</span>
                    <Button size="sm" className="h-7 text-xs bg-[#1FA8A8] hover:bg-[#198a8a] text-white" onClick={() => openAddRecordModal("checkup")}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Check-up
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reason / Complaint</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Clinical Findings</TableHead>
                        <TableHead>Medications / Products</TableHead>
                        <TableHead>Attending Vet</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {petCheckups(viewPet.id).map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs font-medium">{c.date ? formatDate(c.date) : "—"}</TableCell>
                          <TableCell className="text-xs">{c.chief_complaint || "—"}</TableCell>
                          <TableCell className="text-xs font-semibold text-brand-navy">{c.diagnosis || "General Exam"}</TableCell>
                          <TableCell className="text-xs">{c.findings || "—"}</TableCell>
                          <TableCell className="text-xs">{c.medication || "—"}</TableCell>
                          <TableCell className="text-xs">{c.vet || "Clinic Staff"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditRecordModal(c)} title="Edit Record">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {petCheckups(viewPet.id).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">
                            No check-up records logged yet for this pet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* Tab 3: Vaccinations */}
                <TabsContent value="vaccinations" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-xs font-semibold text-muted-foreground">Vaccination Records ({petVaccinations(viewPet.id).length})</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vaccine / Type</TableHead>
                        <TableHead>Date Given</TableHead>
                        <TableHead>Next Due Date</TableHead>
                        <TableHead>Attending Vet</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {petVaccinations(viewPet.id).map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-semibold text-xs text-brand-navy">{v.vaccine_type}</TableCell>
                          <TableCell className="text-xs">{v.date_given ? formatDate(v.date_given) : "—"}</TableCell>
                          <TableCell className="text-xs font-medium text-brand-teal">{v.next_due ? formatDate(v.next_due) : "—"}</TableCell>
                          <TableCell className="text-xs">{v.vet || "Clinic Staff"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{v.notes || "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditRecordModal(v)} title="Edit Record">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {petVaccinations(viewPet.id).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs py-8 text-muted-foreground">
                            No vaccination records logged yet for this pet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* Tab 4: Treatments */}
                <TabsContent value="treatments" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-xs font-semibold text-muted-foreground">Treatment Records ({petTreatments(viewPet.id).length})</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reason / Complaint</TableHead>
                        <TableHead>Diagnosis</TableHead>
                        <TableHead>Treatment / Procedure</TableHead>
                        <TableHead>Medications / Products</TableHead>
                        <TableHead>Outcome</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {petTreatments(viewPet.id).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs font-medium">{t.date ? formatDate(t.date) : "—"}</TableCell>
                          <TableCell className="text-xs">{t.chief_complaint || "—"}</TableCell>
                          <TableCell className="text-xs font-semibold text-brand-navy">{t.diagnosis || "—"}</TableCell>
                          <TableCell className="text-xs">{t.treatment || "—"}</TableCell>
                          <TableCell className="text-xs">{t.medication || "—"}</TableCell>
                          <TableCell className="text-xs">{t.outcome || "Completed"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditRecordModal(t)} title="Edit Record">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {petTreatments(viewPet.id).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-xs py-8 text-muted-foreground">
                            No treatment records logged yet for this pet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* Tab 5: Dewormings */}
                <TabsContent value="dewormings" className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <span className="text-xs font-semibold text-muted-foreground">Deworming Records ({petDewormings(viewPet.id).length})</span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Date Given</TableHead>
                        <TableHead>Next Due Date</TableHead>
                        <TableHead>Attending Vet</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {petDewormings(viewPet.id).map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-semibold text-xs text-amber-900">{d.product || "Deworming"}</TableCell>
                          <TableCell className="text-xs">{d.date_given ? formatDate(d.date_given) : "—"}</TableCell>
                          <TableCell className="text-xs font-medium text-amber-700">{d.next_due ? formatDate(d.next_due) : "—"}</TableCell>
                          <TableCell className="text-xs">{d.vet || "Clinic Staff"}</TableCell>
                          <TableCell className="text-xs">{d.status || "Completed"}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditRecordModal(d)} title="Edit Record">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {petDewormings(viewPet.id).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs py-8 text-muted-foreground">
                            No deworming records logged yet for this pet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setViewPet(null)}>Close</Button>
                <Button variant="default" onClick={() => handlePrintPetProfile(viewPet)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Medical Profile
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Add/Edit Dialog inside Pet Profile */}
      <Dialog open={showRecordModal} onOpenChange={setShowRecordModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              {editingRecordId ? "Edit Medical Care Record" : "Add Medical Care Record for " + (viewPet?.name || "Pet")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 max-h-[500px] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Record Type *</Label>
                <Select
                  value={recordForm.record_type}
                  onValueChange={(v: any) => setRecordForm({ ...recordForm, record_type: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
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

              <div className="space-y-1">
                <Label className="text-xs">Visit Date *</Label>
                <Input
                  type="date"
                  className="h-9 text-xs"
                  value={recordForm.date}
                  onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Attending Vet / Staff *</Label>
                <Select
                  value={recordForm.vet}
                  onValueChange={(v) => setRecordForm({ ...recordForm, vet: v })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select vet" />
                  </SelectTrigger>
                  <SelectContent>
                    {VET_OPTIONS.map((vet) => (
                      <SelectItem key={vet} value={vet}>
                        {vet}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Type Specific Fields */}
            {recordForm.record_type === "vaccination" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-brand-navy-light/40 border border-brand-navy/20">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-brand-navy">Vaccine Used / Type *</Label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="e.g. DHPP, Rabies, 5-in-1"
                    value={recordForm.vaccine_used}
                    onChange={(e) => setRecordForm({ ...recordForm, vaccine_used: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-brand-navy">Next Vaccination Due Date</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={recordForm.next_vax_due}
                    onChange={(e) => setRecordForm({ ...recordForm, next_vax_due: e.target.value })}
                  />
                </div>
              </div>
            )}

            {recordForm.record_type === "deworming" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-amber-900">Dewormer Product Used *</Label>
                  <Input
                    className="h-9 text-xs"
                    placeholder="e.g. Drontal Plus, Caniverm"
                    value={recordForm.dewormer_used}
                    onChange={(e) => setRecordForm({ ...recordForm, dewormer_used: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-amber-900">Next Deworming Due Date</Label>
                  <Input
                    type="date"
                    className="h-9 text-xs"
                    value={recordForm.next_deworming_due}
                    onChange={(e) => setRecordForm({ ...recordForm, next_deworming_due: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Reason / Chief Complaint</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="e.g. Annual vaccine, Lethargy, Vomiting"
                  value={recordForm.chief_complaint}
                  onChange={(e) => setRecordForm({ ...recordForm, chief_complaint: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Symptoms</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="e.g. Loss of appetite, Fever"
                  value={recordForm.symptoms}
                  onChange={(e) => setRecordForm({ ...recordForm, symptoms: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Diagnosis</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="e.g. Mild Gastroenteritis, Healthy"
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outcome / Status</Label>
                <Input
                  className="h-9 text-xs"
                  placeholder="e.g. Completed, Recovered, Follow-up in 1 wk"
                  value={recordForm.outcome}
                  onChange={(e) => setRecordForm({ ...recordForm, outcome: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Treatment / Procedure Performed</Label>
              <Textarea
                rows={2}
                className="text-xs"
                placeholder="Details of procedure or care given..."
                value={recordForm.treatment}
                onChange={(e) => setRecordForm({ ...recordForm, treatment: e.target.value })}
              />
            </div>

            {/* Inventory / Medications Selection (FEFO Integrated) */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-primary" /> Medications / Products Used (Inventory Deduction)
                </Label>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() =>
                    setMedicationsList((prev) => [
                      ...prev,
                      { inventory_item_id: "", name: "", quantity: 1, unit: "unit", notes: "" },
                    ])
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Product
                </Button>
              </div>

              {medicationsList.map((med, index) => {
                const stockInfo = med.inventory_item_id ? availableStockMap[med.inventory_item_id] : null;
                return (
                  <div key={index} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                    <div className="flex-1">
                      <Select
                        value={med.inventory_item_id}
                        onValueChange={(val) => {
                          const targetItem = inventoryItems.find((i: any) => i.id === val);
                          setMedicationsList((prev) =>
                            prev.map((row, i) =>
                              i === index
                                ? {
                                    ...row,
                                    inventory_item_id: val,
                                    name: targetItem?.name || "",
                                    unit: targetItem?.unit || "unit",
                                  }
                                : row
                            )
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select inventory product" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventoryItems.map((item: any) => {
                            const info = availableStockMap[item.id];
                            const qty = info?.totalQty ?? 0;
                            return (
                              <SelectItem key={item.id} value={item.id} disabled={qty <= 0}>
                                {item.name} ({qty} {item.unit || "unit"}{qty <= 0 ? " - Out of stock" : ""})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {stockInfo && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Available Stock: {stockInfo.totalQty} {stockInfo.unit}
                        </p>
                      )}
                    </div>

                    <div className="w-20">
                      <Input
                        type="number"
                        min={1}
                        className="h-8 text-xs"
                        placeholder="Qty"
                        value={med.quantity}
                        onChange={(e) => {
                          const q = parseInt(e.target.value) || 1;
                          setMedicationsList((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, quantity: Math.max(1, q) } : row))
                          );
                        }}
                      />
                    </div>

                    <div className="w-28">
                      <Input
                        className="h-8 text-xs"
                        placeholder="Dose notes"
                        value={med.notes || ""}
                        onChange={(e) => {
                          const n = e.target.value;
                          setMedicationsList((prev) =>
                            prev.map((row, i) => (i === index ? { ...row, notes: n } : row))
                          );
                        }}
                      />
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                      onClick={() => setMedicationsList((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Special Instructions / Additional Notes</Label>
              <Textarea
                rows={2}
                className="text-xs"
                placeholder="Follow-up instructions or general notes..."
                value={recordForm.notes}
                onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setShowRecordModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRecord} disabled={savingRecord}>
              {savingRecord ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingRecordId ? "Save Changes" : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Pet Dialog */}
      <Dialog open={!!deletePetTarget} onOpenChange={() => setDeletePetTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-heading">
              <AlertTriangle className="h-5 w-5" /> Confirm Delete Pet
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to permanently delete pet <strong>{deletePetTarget?.name}</strong>?
            This will also delete associated medical records.
          </p>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setDeletePetTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeletePet} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Pet Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

