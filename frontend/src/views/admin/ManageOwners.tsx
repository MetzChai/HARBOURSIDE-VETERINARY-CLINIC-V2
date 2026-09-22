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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
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
  UserCheck,
  UserX,
  Phone,
  Mail,
  MapPin,
  Calendar,
  PawPrint,
  FileText,
  DollarSign,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";
import { formatTimeSlot } from "@/lib/appointment-slots";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

type OwnerRow = {
  id: string;
  owner_code?: string | null;
  name: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  contact?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  google_account?: string | null;
  account_status?: string | null;
  is_walk_in?: boolean | null;
  image_url?: string | null;
  created_at?: string;
};

const ITEMS_PER_PAGE = 8;

export default function ManageOwners() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: owners = [], isLoading } = useRows<OwnerRow>("owners", { orderBy: "created_at", ascending: false });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: careRecords = [] } = useRows<any>("care_records", { orderBy: "date", ascending: false });
  const { data: transactions = [] } = useRows<any>("lab_transactions", { orderBy: "created_at", ascending: false });

  const invalidate = useInvalidate();

  // Search & Filter
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWalkIn, setFilterWalkIn] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [viewOwner, setViewOwner] = useState<OwnerRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editOwner, setEditOwner] = useState<OwnerRow | null>(null);
  const [deleteOwnerTarget, setDeleteOwnerTarget] = useState<OwnerRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Owner Form State
  const emptyForm = {
    owner_code: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "Male",
    birth_date: "",
    contact: "",
    email: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    google_account: "",
    account_status: "Active",
    is_walk_in: false,
    image_url: "",
  };

  const [form, setForm] = useState(emptyForm);

  const openAdd = (isWalkIn = false) => {
    const code = `OWN-${Date.now().toString().slice(-6)}`;
    setForm({
      ...emptyForm,
      owner_code: code,
      is_walk_in: isWalkIn,
    });
    setShowAdd(true);
  };

  const openEdit = (owner: OwnerRow) => {
    setEditOwner(owner);
    setForm({
      owner_code: owner.owner_code || `OWN-${owner.id.slice(0, 6)}`,
      first_name: owner.first_name || owner.name.split(" ")[0] || "",
      middle_name: owner.middle_name || "",
      last_name: owner.last_name || owner.name.split(" ").slice(1).join(" ") || "",
      gender: owner.gender || "Male",
      birth_date: owner.birth_date || "",
      contact: owner.contact || "",
      email: owner.email || "",
      address: owner.address || "",
      emergency_contact_name: owner.emergency_contact_name || "",
      emergency_contact_number: owner.emergency_contact_number || "",
      google_account: owner.google_account || "",
      account_status: owner.account_status || "Active",
      is_walk_in: !!owner.is_walk_in,
      image_url: owner.image_url || "",
    });
  };

  const handleSaveOwner = async () => {
    const fullName = [form.first_name, form.middle_name, form.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!fullName) {
      toast.error("First name and last name are required.");
      return;
    }

    setSaving(true);
    const code = form.owner_code || `OWN-${Date.now().toString().slice(-6)}`;

    const payload = {
      owner_code: code,
      name: fullName,
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      last_name: form.last_name.trim(),
      gender: form.gender,
      birth_date: form.birth_date || null,
      contact: form.contact.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_number: form.emergency_contact_number.trim() || null,
      google_account: form.google_account.trim() || null,
      account_status: form.account_status,
      is_walk_in: form.is_walk_in,
      image_url: form.image_url || null,
    };

    const { error } = editOwner
      ? await db.from("owners").update(payload as any).eq("id", editOwner.id)
      : await db.from("owners").insert(payload as any);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editOwner ? `${fullName} updated successfully.` : `${fullName} registered successfully.`);
    setShowAdd(false);
    setEditOwner(null);
    setForm(emptyForm);
    invalidate("owners");
  };

  const handleDeleteOwner = async () => {
    if (!deleteOwnerTarget || !isAdmin) return;

    setSaving(true);
    const { error } = await db.from("owners").delete().eq("id", deleteOwnerTarget.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Owner record for ${deleteOwnerTarget.name} deleted.`);
    setDeleteOwnerTarget(null);
    invalidate("owners");
  };

  // Filtered & Search Results
  const filteredOwners = useMemo(() => {
    return owners.filter((o) => {
      const q = search.toLowerCase().trim();
      const codeStr = (o.owner_code || "").toLowerCase();
      const nameStr = o.name.toLowerCase();
      const emailStr = (o.email || "").toLowerCase();
      const contactStr = (o.contact || "").toLowerCase();

      // Search Query
      if (q && !codeStr.includes(q) && !nameStr.includes(q) && !emailStr.includes(q) && !contactStr.includes(q)) {
        return false;
      }

      // Status Filter
      if (filterStatus !== "all" && (o.account_status || "Active").toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }

      // Walk-in Filter
      if (filterWalkIn === "walk_in" && !o.is_walk_in) return false;
      if (filterWalkIn === "online" && o.is_walk_in) return false;

      return true;
    });
  }, [owners, search, filterStatus, filterWalkIn]);

  // Pagination
  const totalPages = Math.ceil(filteredOwners.length / ITEMS_PER_PAGE) || 1;
  const paginatedOwners = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOwners.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOwners, currentPage]);

  const ownerPets = (ownerId: string) => pets.filter((p) => p.owner_id === ownerId);
  const ownerPetIds = (ownerId: string) => new Set(ownerPets(ownerId).map((p) => p.id));

  const ownerAppointments = (ownerId: string) => {
    const pIds = ownerPetIds(ownerId);
    return appointments.filter((a) => a.owner_id === ownerId || pIds.has(a.pet_id));
  };

  const ownerCareRecords = (ownerId: string) => {
    const pIds = ownerPetIds(ownerId);
    return careRecords.filter((c) => pIds.has(c.pet_id));
  };

  const ownerTransactions = (ownerId: string) => {
    return transactions.filter((t) => t.owner_id === ownerId);
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const handlePrintOwner = (owner: OwnerRow) => {
    const petsList = ownerPets(owner.id);
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <head>
          <title>Owner Profile - ${owner.name}</title>
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
          <h2>Pet Owner Record: ${owner.name} <span class="badge">${owner.owner_code || "OWN"}</span></h2>
          
          <div class="info-grid">
            <div><strong>Contact Number:</strong> ${owner.contact || "—"}</div>
            <div><strong>Email Address:</strong> ${owner.email || "—"}</div>
            <div><strong>Address:</strong> ${owner.address || "—"}</div>
            <div><strong>Account Status:</strong> ${owner.account_status || "Active"} (${owner.is_walk_in ? "Walk-in Client" : "Online User"})</div>
            <div><strong>Emergency Contact:</strong> ${owner.emergency_contact_name || "—"} (${owner.emergency_contact_number || "—"})</div>
          </div>

          <h3>Registered Pets (${petsList.length})</h3>
          <table>
            <thead><tr><th>Pet Name</th><th>Species</th><th>Breed</th><th>Gender</th><th>Status</th></tr></thead>
            <tbody>
              ${
                petsList
                  .map(
                    (p) =>
                      `<tr><td>${p.name}</td><td>${p.species || "—"}</td><td>${p.breed || "—"}</td><td>${p.gender || "—"}</td><td>${p.status || "Healthy"}</td></tr>`
                  )
                  .join("") || "<tr><td colSpan='5'>No pets registered</td></tr>"
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
        title="Manage Pet Owners"
        description="Register clients, manage profiles, walk-in records, and billing history"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openAdd(true)}>
              <Plus className="h-4 w-4 mr-1.5 text-brand-teal" /> Walk-in Client
            </Button>
            <Button onClick={() => openAdd(false)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Owner
            </Button>
          </div>
        }
      />

      {/* Filter & Search Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs">Search Owners</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Name, Contact, Email, or Code..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Account Status</Label>
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
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Walk-in Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs">Client Registration Type</Label>
              <Select
                value={filterWalkIn}
                onValueChange={(v) => {
                  setFilterWalkIn(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  <SelectItem value="walk_in">Walk-in Owners Only</SelectItem>
                  <SelectItem value="online">Online Registered Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Owners Table */}
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
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Owner Code</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Full Name</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Contact</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Email</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Pets</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Type</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs">Status</TableHead>
                    <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOwners.length ? (
                    paginatedOwners.map((owner) => (
                      <TableRow key={owner.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {owner.owner_code || `OWN-${owner.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={owner.image_url ?? undefined} alt={owner.name} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                {initials(owner.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-semibold text-foreground">{owner.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{owner.contact || "—"}</TableCell>
                        <TableCell className="text-xs">{owner.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {ownerPets(owner.id).length} Pets
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              owner.is_walk_in
                                ? "bg-brand-teal-light text-brand-teal border-brand-teal/30"
                                : "bg-brand-navy-light text-brand-navy border-brand-navy/20"
                            }
                          >
                            {owner.is_walk_in ? "Walk-in" : "Online"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              (owner.account_status || "Active").toLowerCase() === "active"
                                ? "bg-brand-green-light text-brand-green border-brand-green/30"
                                : "bg-red-50 text-red-800 border-red-200"
                            }
                          >
                            {owner.account_status || "Active"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setViewOwner(owner)}
                              title="View Owner Profile"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => openEdit(owner)}
                              title="Edit Owner"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handlePrintOwner(owner)}
                              title="Print Owner Profile"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            <Link href={`/admin/messages?ownerId=${owner.id}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-[#1FA8A8] hover:text-[#198a8a] hover:bg-[#E8F6F6]"
                                title="Send Message"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>
                            </Link>

                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => setDeleteOwnerTarget(owner)}
                                title="Delete Owner"
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
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        No pet owners found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing {filteredOwners.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{" "}
                  {Math.min(currentPage * ITEMS_PER_PAGE, filteredOwners.length)} of {filteredOwners.length} owners
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

      {/* Add / Edit Owner Dialog */}
      <Dialog
        open={showAdd || !!editOwner}
        onOpenChange={(o) => {
          if (!o) {
            setShowAdd(false);
            setEditOwner(null);
          }
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="font-heading">
              {editOwner ? "Edit Owner Information" : form.is_walk_in ? "Register Walk-in Client" : "Register Pet Owner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            <div className="flex justify-center">
              <ImageUpload
                currentImage={form.image_url}
                fallback={form.first_name ? initials(`${form.first_name} ${form.last_name}`) : "?"}
                folder="owners"
                size="lg"
                onImageUploaded={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">First Name *</Label>
                <Input
                  placeholder="First Name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Middle Name</Label>
                <Input
                  placeholder="Middle Name"
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Last Name *</Label>
                <Input
                  placeholder="Last Name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Gender</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Birth Date</Label>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Contact Number</Label>
                <Input
                  placeholder="09171234567"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Email Address</Label>
                <Input
                  type="email"
                  placeholder="owner@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Home Address</Label>
              <Input
                placeholder="Complete Street Address, City"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Emergency Contact Person</Label>
                <Input
                  placeholder="Contact Person Name"
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Emergency Phone</Label>
                <Input
                  placeholder="Emergency Phone #"
                  value={form.emergency_contact_number}
                  onChange={(e) => setForm({ ...form, emergency_contact_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Account Status</Label>
                <Select value={form.account_status} onValueChange={(v) => setForm({ ...form, account_status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="walkin-check"
                  checked={form.is_walk_in}
                  onCheckedChange={(checked) => setForm({ ...form, is_walk_in: !!checked })}
                />
                <Label htmlFor="walkin-check" className="text-xs font-semibold cursor-pointer">
                  Mark as Walk-in Client (No Online Account)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => { setShowAdd(false); setEditOwner(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveOwner} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editOwner ? "Save Changes" : "Save Owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Owner Profile Modal */}
      <Dialog open={!!viewOwner} onOpenChange={() => setViewOwner(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {viewOwner && (
            <>
              <DialogHeader className="p-6 pb-2 border-b">
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" /> {viewOwner.name}
                  </DialogTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    {viewOwner.owner_code || `OWN-${viewOwner.id.slice(0, 6)}`}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
                <Tabs defaultValue="info" className="space-y-4">
                  <TabsList className="bg-muted p-1">
                    <TabsTrigger value="info" className="text-xs">Personal Info</TabsTrigger>
                    <TabsTrigger value="pets" className="text-xs">Registered Pets ({ownerPets(viewOwner.id).length})</TabsTrigger>
                    <TabsTrigger value="appointments" className="text-xs">Appointments</TabsTrigger>
                    <TabsTrigger value="care" className="text-xs">Care History</TabsTrigger>
                    <TabsTrigger value="billing" className="text-xs">Billing History</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: Personal Info */}
                  <TabsContent value="info" className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-card">
                      <Avatar className="h-20 w-20">
                        <AvatarImage src={viewOwner.image_url ?? undefined} alt={viewOwner.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                          {initials(viewOwner.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="grid grid-cols-2 gap-3 text-sm flex-1">
                        <div><span className="text-muted-foreground text-xs block">Contact Number</span> {viewOwner.contact || "—"}</div>
                        <div><span className="text-muted-foreground text-xs block">Email Address</span> {viewOwner.email || "—"}</div>
                        <div><span className="text-muted-foreground text-xs block">Gender</span> {viewOwner.gender || "—"}</div>
                        <div><span className="text-muted-foreground text-xs block">Birth Date</span> {viewOwner.birth_date ? formatDate(viewOwner.birth_date) : "—"}</div>
                        <div className="col-span-2"><span className="text-muted-foreground text-xs block">Home Address</span> {viewOwner.address || "—"}</div>
                        <div><span className="text-muted-foreground text-xs block">Emergency Contact</span> {viewOwner.emergency_contact_name || "—"}</div>
                        <div><span className="text-muted-foreground text-xs block">Emergency Phone</span> {viewOwner.emergency_contact_number || "—"}</div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tab 2: Registered Pets */}
                  <TabsContent value="pets">
                    <div className="space-y-2">
                      {ownerPets(viewOwner.id).map((pet) => (
                        <div key={pet.id} className="p-3 rounded-lg border flex items-center justify-between bg-card">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">{pet.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-sm">{pet.name}</p>
                              <p className="text-xs text-muted-foreground">{pet.species} • {pet.breed || "Crossbreed"}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">{pet.status || "Healthy"}</Badge>
                        </div>
                      ))}
                      {ownerPets(viewOwner.id).length === 0 && (
                        <p className="text-xs text-muted-foreground py-6 text-center">No pets registered under this owner.</p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Tab 3: Appointments */}
                  <TabsContent value="appointments">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {ownerAppointments(viewOwner.id).map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">{formatDate(a.date)}</TableCell>
                            <TableCell className="text-xs">{formatTimeSlot(a.time)}</TableCell>
                            <TableCell className="text-xs">{a.appointment_type || a.care_type}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{a.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {ownerAppointments(viewOwner.id).length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-xs py-6 text-muted-foreground">No appointments recorded.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  {/* Tab 4: Care History */}
                  <TabsContent value="care">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Date</TableHead><TableHead>Care Type</TableHead><TableHead>Diagnosis</TableHead><TableHead>Vet</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {ownerCareRecords(viewOwner.id).map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs">{formatDate(c.date)}</TableCell>
                            <TableCell className="text-xs capitalize">{c.care_type}</TableCell>
                            <TableCell className="text-xs">{c.diagnosis || c.chief_complaint || "—"}</TableCell>
                            <TableCell className="text-xs">{c.vet || "Clinic Staff"}</TableCell>
                          </TableRow>
                        ))}
                        {ownerCareRecords(viewOwner.id).length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-xs py-6 text-muted-foreground">No medical care records logged.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  {/* Tab 5: Billing History */}
                  <TabsContent value="billing">
                    <Table>
                      <TableHeader>
                        <TableRow><TableHead>Txn #</TableHead><TableHead>Date</TableHead><TableHead>Total Amount</TableHead><TableHead>Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {ownerTransactions(viewOwner.id).map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs font-bold text-primary">{t.transaction_number || t.id.slice(0, 6)}</TableCell>
                            <TableCell className="text-xs">{formatDate(t.date || t.created_at)}</TableCell>
                            <TableCell className="font-semibold text-xs">₱{Number(t.total_amount || 0).toLocaleString()}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{t.payment_status || "Paid"}</Badge></TableCell>
                          </TableRow>
                        ))}
                        {ownerTransactions(viewOwner.id).length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center text-xs py-6 text-muted-foreground">No billing transactions recorded.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TabsContent>
                </Tabs>
              </div>

              <DialogFooter className="p-4 border-t bg-muted/30 flex items-center justify-between sm:justify-end gap-2">
                <Button variant="outline" onClick={() => setViewOwner(null)}>Close</Button>
                <Button variant="outline" onClick={() => handlePrintOwner(viewOwner)}>
                  <Printer className="h-4 w-4 mr-1" /> Print Profile
                </Button>
                <Link href={`/admin/messages?ownerId=${viewOwner.id}`}>
                  <Button className="bg-[#1B3A5C] hover:bg-[#152e4a] text-white">
                    <MessageSquare className="h-4 w-4 mr-1 text-[#1FA8A8]" /> Send Message
                  </Button>
                </Link>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Owner Confirmation Dialog */}
      <Dialog open={!!deleteOwnerTarget} onOpenChange={() => setDeleteOwnerTarget(null)}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-heading">
              <AlertTriangle className="h-5 w-5" /> Confirm Delete Owner
            </DialogTitle>
          </DialogHeader>
          <div className="p-6 overflow-y-auto">
            <p className="text-sm text-muted-foreground py-2">
              Are you sure you want to permanently delete owner <strong>{deleteOwnerTarget?.name}</strong>?
              This will also delete all pets registered under this owner.
            </p>
          </div>
          <DialogFooter className="p-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setDeleteOwnerTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteOwner} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Owner Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
