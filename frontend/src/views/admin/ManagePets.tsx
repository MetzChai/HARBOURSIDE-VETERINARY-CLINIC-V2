"use client";

import { useMemo, useState } from "react";
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
} from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import PetCareHistoryTimeline from "@/components/PetCareHistoryTimeline";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatAge, formatDate } from "@/lib/age";
import { formatNowPH, todayPH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";

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
  cause_of_death?: string | null;
  deceased_date?: string | null;
  owners?: { name: string; contact?: string; email?: string } | null;
};

const ITEMS_PER_PAGE = 8;
const SPECIES_OPTIONS = ["Dog", "Cat", "Bird", "Rabbit", "Reptile", "Other"];
const STATUS_OPTIONS = ["Healthy", "Under Treatment", "Recovered", "Deceased"];

export default function ManagePets() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: pets = [], isLoading } = useRows<PetRow>("pets", { orderBy: "created_at", ascending: false });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: careRecords = [] } = useRows<any>("care_records", { orderBy: "date", ascending: false });
  const { data: vaccinations = [] } = useRows<any>("vaccinations", { orderBy: "date_given", ascending: false });
  const { data: dewormings = [] } = useRows<any>("dewormings", { orderBy: "date_given", ascending: false });

  const invalidate = useInvalidate();

  // Search, Filter & Pagination
  const [search, setSearch] = useState("");
  const [filterSpecies, setFilterSpecies] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOwnerId, setFilterOwnerId] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [viewPet, setViewPet] = useState<PetRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editPet, setEditPet] = useState<PetRow | null>(null);
  const [deletePetTarget, setDeletePetTarget] = useState<PetRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State
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
      status: pet.status || "Healthy",
      cause_of_death: pet.cause_of_death || "",
      deceased_date: pet.deceased_date || "",
    });
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
      status: form.status,
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

      // Search Query
      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q) && !speciesStr.includes(q) && !breedStr.includes(q)) {
        return false;
      }

      // Species Filter
      if (filterSpecies !== "all" && speciesStr !== filterSpecies.toLowerCase()) return false;

      // Status Filter
      if (filterStatus !== "all" && (p.status || "Healthy").toLowerCase() !== filterStatus.toLowerCase()) return false;

      // Owner Filter
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
  const petTreatments = (petId: string) => careRecords.filter((c) => c.pet_id === petId && c.care_type === "treatment");

  const getPetStatusBadge = (status?: string | null) => {
    const s = (status ?? "Healthy").toLowerCase();
    switch (s) {
      case "under_treatment":
      case "under treatment":
        return <Badge className="bg-amber-500 text-white">Under Treatment</Badge>;
      case "recovered":
        return <Badge className="bg-blue-600 text-white">Recovered</Badge>;
      case "deceased":
        return <Badge variant="destructive">Deceased</Badge>;
      default:
        return <Badge className="bg-emerald-600 text-white">Healthy</Badge>;
    }
  };

  const handlePrintPetProfile = (pet: PetRow) => {
    const owner = ownerMap.get(pet.owner_id) || pet.owners;
    const vax = petVaccinations(pet.id);
    const appts = petAppointments(pet.id);

    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <head>
          <title>Pet Medical Record - ${pet.name}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin-bottom: 2px; }
            .badge { background: #e8eef4; color: #1B3A5C; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Pet Medical Profile: ${pet.name} <span class="badge">${pet.pet_code || "PET"}</span></h2>
          
          <div class="info-grid">
            <div><strong>Species & Breed:</strong> ${pet.species || "—"} (${pet.breed || "Crossbreed"})</div>
            <div><strong>Owner Name:</strong> ${owner?.name || "—"}</div>
            <div><strong>Gender & Age:</strong> ${pet.gender || "—"} | ${pet.dob ? formatAge(pet.dob) : pet.estimated_age || "—"}</div>
            <div><strong>Weight & Color:</strong> ${pet.weight || "—"} | ${pet.color || "—"}</div>
            <div><strong>Microchip #:</strong> ${pet.microchip_number || "—"}</div>
            <div><strong>Health Status:</strong> ${pet.status || "Healthy"}</div>
            <div><strong>Allergies:</strong> ${pet.allergies || "None"}</div>
            <div><strong>Existing Conditions:</strong> ${pet.existing_conditions || "None"}</div>
          </div>

          <h3>Vaccination Records (${vax.length})</h3>
          <table>
            <thead><tr><th>Vaccine</th><th>Date Given</th><th>Next Due</th><th>Veterinarian</th></tr></thead>
            <tbody>
              ${
                vax
                  .map(
                    (v) =>
                      `<tr><td>${v.vaccine_type}</td><td>${formatDate(v.date_given)}</td><td>${v.next_due ? formatDate(v.next_due) : "—"}</td><td>${v.vet || "Clinic Staff"}</td></tr>`
                  )
                  .join("") || "<tr><td colSpan='4'>No vaccination records logged</td></tr>"
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

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Manage Pets</h1>
          <p className="text-muted-foreground text-sm">
            Register pets, manage medical profiles, status tracking, and care timelines
          </p>
        </div>
        <Button onClick={openAdd} disabled={owners.length === 0}>
          <Plus className="h-4 w-4 mr-1.5" /> Register Pet
        </Button>
      </div>

      {/* Filter & Search Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Search */}
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

            {/* Species Filter */}
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

            {/* Status Filter */}
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
                  <TableRow>
                    <TableHead>Pet Code</TableHead>
                    <TableHead>Pet</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Species & Breed</TableHead>
                    <TableHead>Gender / Age</TableHead>
                    <TableHead>Health Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
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
                        <TableCell>{getPetStatusBadge(pet.status)}</TableCell>
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
      <Dialog open={!!viewPet} onOpenChange={() => setViewPet(null)}>
        <DialogContent className="max-w-3xl">
          {viewPet && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
                    <PawPrint className="h-5 w-5 text-primary" /> {viewPet.name}'s Profile
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {viewPet.pet_code || `PET-${viewPet.id.slice(0, 6)}`}
                    </Badge>
                    {getPetStatusBadge(viewPet.status)}
                  </div>
                </div>
              </DialogHeader>

              <Tabs defaultValue="info" className="space-y-4 pt-2">
                <TabsList className="bg-muted p-1">
                  <TabsTrigger value="info" className="text-xs">Pet & Owner Info</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs">Care History Timeline</TabsTrigger>
                  <TabsTrigger value="vaccinations" className="text-xs">Vaccinations ({petVaccinations(viewPet.id).length})</TabsTrigger>
                  <TabsTrigger value="treatments" className="text-xs">Treatments ({petTreatments(viewPet.id).length})</TabsTrigger>
                  <TabsTrigger value="dewormings" className="text-xs">Dewormings ({petDewormings(viewPet.id).length})</TabsTrigger>
                </TabsList>

                {/* Tab 1: Pet & Owner Info */}
                <TabsContent value="info" className="space-y-4">
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
                <TabsContent value="timeline">
                  <div className="max-h-[350px] overflow-y-auto pr-1">
                    <PetCareHistoryTimeline petId={viewPet.id} />
                  </div>
                </TabsContent>

                {/* Tab 3: Vaccinations */}
                <TabsContent value="vaccinations">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Vaccine</TableHead><TableHead>Date Given</TableHead><TableHead>Next Due</TableHead><TableHead>Vet</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {petVaccinations(viewPet.id).map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-semibold text-xs">{v.vaccine_type}</TableCell>
                          <TableCell className="text-xs">{formatDate(v.date_given)}</TableCell>
                          <TableCell className="text-xs">{v.next_due ? formatDate(v.next_due) : "—"}</TableCell>
                          <TableCell className="text-xs">{v.vet || "Clinic Staff"}</TableCell>
                        </TableRow>
                      ))}
                      {petVaccinations(viewPet.id).length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs py-6 text-muted-foreground">No vaccination records logged.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* Tab 4: Treatments */}
                <TabsContent value="treatments">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Date</TableHead><TableHead>Chief Complaint</TableHead><TableHead>Diagnosis</TableHead><TableHead>Outcome</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {petTreatments(viewPet.id).map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs">{formatDate(t.date)}</TableCell>
                          <TableCell className="text-xs">{t.chief_complaint || "—"}</TableCell>
                          <TableCell className="text-xs font-medium">{t.diagnosis || "—"}</TableCell>
                          <TableCell className="text-xs">{t.outcome || "Ongoing"}</TableCell>
                        </TableRow>
                      ))}
                      {petTreatments(viewPet.id).length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs py-6 text-muted-foreground">No treatment records logged.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                {/* Tab 5: Dewormings */}
                <TabsContent value="dewormings">
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead>Product</TableHead><TableHead>Date Given</TableHead><TableHead>Next Due</TableHead><TableHead>Vet</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {petDewormings(viewPet.id).map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-semibold text-xs">{d.product || "Deworming"}</TableCell>
                          <TableCell className="text-xs">{formatDate(d.date_given)}</TableCell>
                          <TableCell className="text-xs">{d.next_due ? formatDate(d.next_due) : "—"}</TableCell>
                          <TableCell className="text-xs">{d.vet || "Clinic Staff"}</TableCell>
                        </TableRow>
                      ))}
                      {petDewormings(viewPet.id).length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs py-6 text-muted-foreground">No deworming records logged.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setViewPet(null)}>Close</Button>
                <Button variant="outline" onClick={() => handlePrintPetProfile(viewPet)}>
                  <Printer className="h-4 w-4 mr-1" /> Print Profile
                </Button>
              </DialogFooter>
            </>
          )}
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
