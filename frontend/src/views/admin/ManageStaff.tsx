"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/age";
import { useAuth } from "@/hooks/useAuth";
import { canManageStaff, roleLabel, type AppRole } from "@/lib/roles";

type ClinicAccount = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  createdAt: string;
};

type OwnerAccount = {
  id: string;
  email: string;
  fullName: string | null;
  role: "owner";
  authMethod: "google" | "password";
  createdAt: string;
};

type StaffForm = {
  email: string;
  fullName: string;
  password: string;
};

const emptyForm: StaffForm = { email: "", fullName: "", password: "" };

export default function ManageStaff() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [staffAccounts, setStaffAccounts] = useState<ClinicAccount[]>([]);
  const [ownerAccounts, setOwnerAccounts] = useState<OwnerAccount[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingOwners, setLoadingOwners] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    const res = await fetch("/api/staff", { credentials: "include" });
    if (!res.ok) {
      toast.error("Failed to load staff accounts");
      setLoadingStaff(false);
      return;
    }
    const data = await res.json();
    setStaffAccounts(data.accounts ?? []);
    setLoadingStaff(false);
  }, []);

  const loadOwners = useCallback(async () => {
    setLoadingOwners(true);
    const res = await fetch("/api/staff/owners", { credentials: "include" });
    if (!res.ok) {
      toast.error("Failed to load pet owner accounts");
      setLoadingOwners(false);
      return;
    }
    const data = await res.json();
    setOwnerAccounts(data.accounts ?? []);
    setLoadingOwners(false);
  }, []);

  useEffect(() => {
    if (!authLoading && !canManageStaff(role)) {
      router.replace("/admin");
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (!authLoading && canManageStaff(role)) {
      loadStaff();
      loadOwners();
    }
  }, [authLoading, role, loadStaff, loadOwners]);

  const openCreate = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const save = async () => {
    if (!form.fullName.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/staff", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to create staff account");
      return;
    }
    toast.success("Staff account created");
    setOpen(false);
    loadStaff();
  };

  const removeStaff = async (account: ClinicAccount) => {
    if (account.role === "admin") {
      toast.error("Admin accounts cannot be deleted from this page");
      return;
    }
    if (!confirm(`Delete staff account for ${account.fullName ?? account.email}? This cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/staff/${account.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delete account");
      return;
    }
    toast.success("Staff account deleted");
    loadStaff();
  };

  const removeOwner = async (account: OwnerAccount) => {
    if (
      !confirm(
        `Delete pet owner account for ${account.fullName ?? account.email}? Their pets and records will also be removed. This cannot be undone.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/staff/owners/${account.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to delete account");
      return;
    }
    toast.success("Pet owner account deleted");
    loadOwners();
  };

  if (authLoading || !canManageStaff(role)) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <UserCog className="h-6 w-6 text-primary" /> Account Management
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage clinic staff sign-in accounts and registered pet owner accounts
        </p>
      </div>

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Clinic Staff</TabsTrigger>
          <TabsTrigger value="owners">Pet Owners</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> New Staff
            </Button>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loadingStaff ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.fullName ?? "—"}</TableCell>
                        <TableCell>{account.email}</TableCell>
                        <TableCell>
                          <Badge variant={account.role === "admin" ? "default" : "secondary"}>
                            {roleLabel(account.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(account.createdAt)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {account.role === "staff" && account.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStaff(account)}
                              aria-label="Delete staff account"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {staffAccounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No clinic accounts yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

         
        </TabsContent>

        <TabsContent value="owners" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loadingOwners ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Sign-in</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ownerAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.fullName ?? "—"}</TableCell>
                        <TableCell>{account.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {account.authMethod === "google" ? "Google" : "Email & password"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(account.createdAt)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOwner(account)}
                            aria-label="Delete pet owner account"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {ownerAccounts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          No pet owner accounts yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Pet owners register through the public <code className="text-xs">/signup</code> page or Google sign-in.
            Deleting an account removes their linked pets and records.
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">New Staff Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full Name</Label>
              <Input
                id="staff-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-password">Password</Label>
              <Input
                id="staff-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="At least 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
