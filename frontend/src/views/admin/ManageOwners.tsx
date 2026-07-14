"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Pencil, Plus, Printer, Search, Users, Loader2 } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatNowPH } from "@/lib/datetime";

type OwnerRow = {
  id: string;
  name: string;
  contact: string | null;
  email: string | null;
  address: string | null;
  image_url: string | null;
};

export default function ManageOwners() {
  const { data: owners = [], isLoading } = useRows<OwnerRow>("owners", { orderBy: "name" });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const invalidate = useInvalidate();

  const [search, setSearch] = useState("");
  const [viewOwner, setViewOwner] = useState<OwnerRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: "", contact: "", email: "", address: "", image_url: "" });
  const [editOwner, setEditOwner] = useState<OwnerRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", contact: "", email: "", address: "", image_url: "" });

  const petsByOwner = (ownerId: string) => pets.filter((p) => p.owner_id === ownerId);

  const openEdit = (owner: OwnerRow) => {
    setEditOwner(owner);
    setEditForm({
      name: owner.name,
      contact: owner.contact ?? "",
      email: owner.email ?? "",
      address: owner.address ?? "",
      image_url: owner.image_url ?? "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editOwner) return;
    if (!editForm.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    const { error } = await db.from("owners").update({
      name: editForm.name.trim(),
      contact: editForm.contact.trim() || null,
      email: editForm.email.trim() || null,
      address: editForm.address.trim() || null,
      image_url: editForm.image_url || null,
    } as any).eq("id", editOwner.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${editForm.name} has been updated.`);
    setEditOwner(null);
    invalidate("owners");
  };

  const filtered = useMemo(() => owners.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.email ?? "").toLowerCase().includes(search.toLowerCase())
  ), [owners, search]);

  const handleAddOwner = async () => {
    if (!newOwner.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    const { error } = await db.from("owners").insert({
      name: newOwner.name.trim(),
      contact: newOwner.contact.trim() || null,
      email: newOwner.email.trim() || null,
      address: newOwner.address.trim() || null,
      image_url: newOwner.image_url || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${newOwner.name} has been registered.`);
    setNewOwner({ name: "", contact: "", email: "", address: "", image_url: "" });
    setShowAdd(false);
    invalidate("owners");
  };

  const initials = (name: string) => name.split(" ").map((n) => n[0]).join("");

  const handlePrint = (owner: OwnerRow) => {
    const ownerPets = petsByOwner(owner.id);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Owner Info - ${owner.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a}
      h1{color:#c0392b}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#fdecea;color:#c0392b}
      .header{border-bottom:2px solid #c0392b;padding-bottom:12px;margin-bottom:20px}
      .profile{display:flex;align-items:flex-start;gap:20px;margin-bottom:16px}
      .profile img{width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid #c0392b}
      .profile .initials{width:100px;height:100px;border-radius:50%;background:#fdecea;color:#c0392b;display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:bold;border:3px solid #c0392b}</style></head>
      <body><div class="header"><h1>🩺 Harbourside Veterinary Clinic</h1><p>Owner Information Report</p></div>
      <div class="profile">
        ${owner.image_url ? `<img src="${owner.image_url}" alt="${owner.name}" />` : `<div class="initials">${initials(owner.name)}</div>`}
        <div>
          <h2 style="margin:0 0 8px">${owner.name}</h2>
          <p><strong>Contact:</strong> ${owner.contact ?? "—"} | <strong>Email:</strong> ${owner.email ?? "—"}</p>
          <p><strong>Address:</strong> ${owner.address ?? "—"}</p>
        </div>
      </div>
      <h3>Registered Pets</h3>
      <table><tr><th>Pet Name</th><th>Species</th><th>Breed</th><th>Gender</th></tr>
      ${ownerPets.map((p) => `<tr><td>${p.name}</td><td>${p.species ?? "—"}</td><td>${p.breed ?? "—"}</td><td>${p.gender ?? "—"}</td></tr>`).join("")}
      </table><br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold">Manage Owners</h1>
          <p className="text-muted-foreground text-sm">{owners.length} owners registered</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Owner
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search owners..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Owner</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((owner) => (
                  <TableRow key={owner.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={owner.image_url ?? undefined} alt={owner.name} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                            {initials(owner.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{owner.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{owner.contact ?? "—"}</TableCell>
                    <TableCell>{owner.email ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{owner.address ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewOwner(owner)}><Eye className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(owner)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handlePrint(owner)}><Printer className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No owners found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewOwner} onOpenChange={() => setViewOwner(null)}>
        <DialogContent>
          {viewOwner && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" /> {viewOwner.name}
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={viewOwner.image_url ?? undefined} alt={viewOwner.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">{initials(viewOwner.name)}</AvatarFallback>
                </Avatar>
                <div className="space-y-2 text-sm flex-1">
                  <p><span className="text-muted-foreground">Contact:</span> {viewOwner.contact ?? "—"}</p>
                  <p><span className="text-muted-foreground">Email:</span> {viewOwner.email ?? "—"}</p>
                  <p><span className="text-muted-foreground">Address:</span> {viewOwner.address ?? "—"}</p>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-heading font-semibold mb-2">Registered Pets</h4>
                <div className="space-y-2">
                  {petsByOwner(viewOwner.id).map((pet) => (
                    <div key={pet.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{pet.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{pet.name}</p>
                        <p className="text-xs text-muted-foreground">{pet.species} · {pet.breed}</p>
                      </div>
                    </div>
                  ))}
                  {petsByOwner(viewOwner.id).length === 0 && <p className="text-xs text-muted-foreground">No pets yet.</p>}
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button variant="outline" onClick={() => handlePrint(viewOwner)}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Add New Owner
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <ImageUpload
              currentImage={newOwner.image_url}
              fallback={newOwner.name ? initials(newOwner.name) : "?"}
              folder="owners"
              size="lg"
              onImageUploaded={(url) => setNewOwner((prev) => ({ ...prev, image_url: url }))}
            />
          </div>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="owner-name">Full Name *</Label>
              <Input id="owner-name" value={newOwner.name} onChange={(e) => setNewOwner((p) => ({ ...p, name: e.target.value }))} placeholder="Juan Dela Cruz" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="owner-contact">Contact</Label>
                <Input id="owner-contact" value={newOwner.contact} onChange={(e) => setNewOwner((p) => ({ ...p, contact: e.target.value }))} placeholder="09171234567" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Email</Label>
                <Input id="owner-email" type="email" value={newOwner.email} onChange={(e) => setNewOwner((p) => ({ ...p, email: e.target.value }))} placeholder="owner@email.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-address">Address</Label>
              <Input id="owner-address" value={newOwner.address} onChange={(e) => setNewOwner((p) => ({ ...p, address: e.target.value }))} placeholder="123 Main St, City" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddOwner} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Owner"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOwner} onOpenChange={(open) => !open && setEditOwner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Owner
            </DialogTitle>
          </DialogHeader>
          {editOwner && (
            <>
              <div className="flex justify-center">
                <ImageUpload
                  currentImage={editForm.image_url}
                  fallback={editForm.name ? initials(editForm.name) : "?"}
                  folder="owners"
                  size="lg"
                  onImageUploaded={(url) => setEditForm((prev) => ({ ...prev, image_url: url }))}
                />
              </div>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-owner-name">Full Name *</Label>
                  <Input id="edit-owner-name" value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-owner-contact">Contact</Label>
                    <Input id="edit-owner-contact" value={editForm.contact} onChange={(e) => setEditForm((p) => ({ ...p, contact: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-owner-email">Email</Label>
                    <Input id="edit-owner-email" type="email" value={editForm.email} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-owner-address">Address</Label>
                  <Input id="edit-owner-address" value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOwner(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

