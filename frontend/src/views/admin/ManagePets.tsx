"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Eye, Pencil, Printer, Search, PawPrint, Skull } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { formatAge } from "@/lib/age";
import { todayPH, formatNowPH } from "@/lib/datetime";
import { toast } from "@/hooks/use-toast";

type Pet = {
  id: string;
  owner_id: string;
  name: string;
  species: string | null;
  breed: string | null;
  gender: string | null;
  dob: string | null;
  image_url: string | null;
  status: "available" | "deceased";
  cause_of_death: string | null;
  deceased_date: string | null;
  owners?: { name: string } | null;
};

const emptyForm = {
  name: "",
  species: "",
  breed: "",
  gender: "Male",
  dob: "",
  owner_id: "",
  image_url: "",
};

export default function ManagePets() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewPet, setViewPet] = useState<Pet | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editPet, setEditPet] = useState<Pet | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [deceasePet, setDeceasePet] = useState<Pet | null>(null);
  const [cause, setCause] = useState("");

  const { data: pets = [] } = useQuery({
    queryKey: ["pets"],
    queryFn: async () => {
      const { data, error } = await db
        .from("pets")
        .select("*, owners(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Pet[];
    },
  });

  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => {
      const { data, error } = await db.from("owners").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pets"] });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("pets").insert({
        name: addForm.name.trim(),
        species: addForm.species || null,
        breed: addForm.breed.trim() || null,
        gender: addForm.gender || null,
        dob: addForm.dob || null,
        owner_id: addForm.owner_id,
        image_url: addForm.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setShowAdd(false);
      setAddForm({ ...emptyForm });
      toast({ title: "Pet registered" });
    },
    onError: (e: any) => toast({ title: "Could not add pet", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editPet) return;
      const { error } = await db
        .from("pets")
        .update({
          name: editForm.name.trim(),
          species: editForm.species || null,
          breed: editForm.breed.trim() || null,
          gender: editForm.gender || null,
          dob: editForm.dob || null,
          owner_id: editForm.owner_id,
          image_url: editForm.image_url || null,
        })
        .eq("id", editPet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setEditPet(null);
      toast({ title: "Pet updated" });
    },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const deceaseMutation = useMutation({
    mutationFn: async () => {
      if (!deceasePet) return;
      const { error } = await db
        .from("pets")
        .update({ status: "deceased", cause_of_death: cause.trim() || null, deceased_date: todayPH() })
        .eq("id", deceasePet.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setDeceasePet(null);
      setCause("");
      toast({ title: "Marked as deceased" });
    },
    onError: (e: any) => toast({ title: "Could not update", description: e.message, variant: "destructive" }),
  });

  const filtered = pets.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.species ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (p.owners?.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (pet: Pet) => {
    setEditPet(pet);
    setEditForm({
      name: pet.name,
      species: pet.species ?? "",
      breed: pet.breed ?? "",
      gender: pet.gender ?? "Male",
      dob: pet.dob ?? "",
      owner_id: pet.owner_id,
      image_url: pet.image_url ?? "",
    });
  };

  const handlePrint = (pet: Pet) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Pet Profile - ${pet.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a}
      h1{color:#1B3A5C;margin-bottom:4px}
      .header{border-bottom:2px solid #1B3A5C;padding-bottom:12px;margin-bottom:20px}</style></head>
      <body><div class="header"><h1>Harbourside Veterinary Clinic</h1><p>Pet Profile Report</p></div>
      <h2>${pet.name}</h2>
      <p><strong>Species:</strong> ${pet.species ?? "-"} | <strong>Breed:</strong> ${pet.breed ?? "-"} |
      <strong>Gender:</strong> ${pet.gender ?? "-"} | <strong>DOB:</strong> ${pet.dob ?? "-"}</p>
      <p><strong>Owner:</strong> ${pet.owners?.name ?? "-"}</p>
      <p><strong>Status:</strong> ${pet.status}${pet.status === "deceased" ? ` (${pet.cause_of_death ?? ""})` : ""}</p>
      <br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p>
      </body></html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Manage Pets</h1>
          <p className="text-muted-foreground text-sm">{pets.length} pets registered</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add Pet</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Add New Pet</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex justify-center">
                <ImageUpload
                  currentImage={addForm.image_url}
                  fallback={addForm.name ? addForm.name[0] : "?"}
                  folder="pets"
                  size="lg"
                  onImageUploaded={(url) => setAddForm((p) => ({ ...p, image_url: url }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Pet Name</Label><Input placeholder="e.g. Max" value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Species</Label>
                  <Select value={addForm.species} onValueChange={(v) => setAddForm((p) => ({ ...p, species: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="Dog">Dog</SelectItem><SelectItem value="Cat">Cat</SelectItem><SelectItem value="Bird">Bird</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Breed</Label><Input placeholder="e.g. Golden Retriever" value={addForm.breed} onChange={(e) => setAddForm((p) => ({ ...p, breed: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Gender</Label>
                  <Select value={addForm.gender} onValueChange={(v) => setAddForm((p) => ({ ...p, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={addForm.dob} onChange={(e) => setAddForm((p) => ({ ...p, dob: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Owner</Label>
                  <Select value={addForm.owner_id} onValueChange={(v) => setAddForm((p) => ({ ...p, owner_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>
                      {owners.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">No owners yet</div>}
                      {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button disabled={!addForm.name.trim() || !addForm.owner_id || addMutation.isPending} onClick={() => addMutation.mutate()}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search pets..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pet</TableHead>
                <TableHead>Species</TableHead>
                <TableHead>Breed</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No pets found.</TableCell></TableRow>
              )}
              {filtered.map((pet) => (
                <TableRow key={pet.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={pet.image_url ?? undefined} alt={pet.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{pet.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{pet.name}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{pet.species ?? "-"}</Badge></TableCell>
                  <TableCell>{pet.breed ?? "-"}</TableCell>
                  <TableCell>{pet.owners?.name ?? "-"}</TableCell>
                  <TableCell>
                    {pet.status === "deceased"
                      ? <Badge variant="outline" className="text-muted-foreground">Deceased</Badge>
                      : <Badge>Available</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setViewPet(pet)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(pet)}><Pencil className="h-4 w-4" /></Button>
                      {pet.status !== "deceased" && (
                        <Button variant="ghost" size="icon" onClick={() => setDeceasePet(pet)}><Skull className="h-4 w-4 text-destructive" /></Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handlePrint(pet)}><Printer className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View */}
      <Dialog open={!!viewPet} onOpenChange={() => setViewPet(null)}>
        <DialogContent className="max-w-2xl">
          {viewPet && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">
                  <PawPrint className="h-5 w-5 text-primary" /> {viewPet.name}'s Profile
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={viewPet.image_url ?? undefined} alt={viewPet.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">{viewPet.name[0]}</AvatarFallback>
                </Avatar>
                <div className="grid grid-cols-2 gap-4 text-sm flex-1">
                  <div><span className="text-muted-foreground">Species:</span> {viewPet.species ?? "-"}</div>
                  <div><span className="text-muted-foreground">Breed:</span> {viewPet.breed ?? "-"}</div>
                  <div><span className="text-muted-foreground">Gender:</span> {viewPet.gender ?? "-"}</div>
                  <div><span className="text-muted-foreground">Age:</span> {viewPet.dob ? formatAge(viewPet.dob) : "-"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Owner:</span> {viewPet.owners?.name ?? "-"}</div>
                  {viewPet.status === "deceased" && (
                    <div className="col-span-2 text-destructive"><span className="text-muted-foreground">Cause of death:</span> {viewPet.cause_of_death ?? "-"} ({viewPet.deceased_date})</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => handlePrint(viewPet)}><Printer className="h-4 w-4 mr-1" /> Print Profile</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editPet} onOpenChange={(open) => !open && setEditPet(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Pet
            </DialogTitle>
          </DialogHeader>
          {editPet && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-center">
                <ImageUpload
                  currentImage={editForm.image_url}
                  fallback={editForm.name ? editForm.name[0] : "?"}
                  folder="pets"
                  size="lg"
                  onImageUploaded={(url) => setEditForm((p) => ({ ...p, image_url: url }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Pet Name</Label><Input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Species</Label>
                  <Select value={editForm.species} onValueChange={(v) => setEditForm((p) => ({ ...p, species: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="Dog">Dog</SelectItem><SelectItem value="Cat">Cat</SelectItem><SelectItem value="Bird">Bird</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Breed</Label><Input value={editForm.breed} onChange={(e) => setEditForm((p) => ({ ...p, breed: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Gender</Label>
                  <Select value={editForm.gender} onValueChange={(v) => setEditForm((p) => ({ ...p, gender: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={editForm.dob} onChange={(e) => setEditForm((p) => ({ ...p, dob: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Owner</Label>
                  <Select value={editForm.owner_id} onValueChange={(v) => setEditForm((p) => ({ ...p, owner_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditPet(null)}>Cancel</Button>
                <Button disabled={!editForm.name.trim() || !editForm.owner_id || editMutation.isPending} onClick={() => editMutation.mutate()}>Save Changes</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark deceased */}
      <AlertDialog open={!!deceasePet} onOpenChange={(open) => !open && setDeceasePet(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {deceasePet?.name} as deceased?</AlertDialogTitle>
            <AlertDialogDescription>
              Records are preserved for history. Please note the cause of death.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Cause of death</Label>
            <Input value={cause} onChange={(e) => setCause(e.target.value)} placeholder="e.g. Old age" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deceaseMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

