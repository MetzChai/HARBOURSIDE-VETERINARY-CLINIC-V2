"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2, UserCog, Users, ShieldAlert, KeyRound, CheckCircle, Ban, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDatePH, formatDateTimePH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";
import { canManageStaff, roleLabel, type AppRole } from "@/lib/roles";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

type UserRecord = {
  id: string;
  email: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
  phone: string | null;
  role: AppRole;
  accountStatus: "Active" | "Deactivated";
  emailVerified: boolean;
  createdAt: string | null;
  lastLogin: string | null;
};

export default function ManageStaff() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  const [staffForm, setStaffForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/staff/users", { credentials: "include" });
      if (!res.ok) {
        toast.error("Failed to load user accounts");
        setLoadingUsers(false);
        return;
      }
      const data = await res.json();
      setUsersList(data.users ?? []);
    } catch {
      toast.error("Error connecting to server.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !canManageStaff(role)) {
      router.replace("/admin");
    }
  }, [authLoading, role, router]);

  useEffect(() => {
    if (!authLoading && canManageStaff(role)) {
      loadUsers();
    }
  }, [authLoading, role, loadUsers]);

  const handleCreateStaff = async () => {
    const { firstName, lastName, email, password } = staffForm;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("First Name, Last Name, and Email are required.");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffForm),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create staff account.");
        setSaving(false);
        return;
      }

      toast.success("Staff account created successfully.");
      setCreateOpen(false);
      setStaffForm({ firstName: "", middleName: "", lastName: "", email: "", phone: "", password: "" });
      loadUsers();
    } catch {
      toast.error("Failed to create staff account.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (account: UserRecord) => {
    if (account.id === user?.id) {
      toast.error("Administrators cannot deactivate their own account.");
      return;
    }

    const newStatus = account.accountStatus === "Active" ? "Deactivated" : "Active";
    const actionLabel = newStatus === "Deactivated" ? "deactivate" : "reactivate";

    if (!confirm(`Are you sure you want to ${actionLabel} account for ${account.fullName}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/staff/users/${account.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Failed to ${actionLabel} account.`);
        return;
      }
      toast.success(`Account ${account.fullName} is now ${newStatus}.`);
      loadUsers();
    } catch {
      toast.error(`Failed to ${actionLabel} account.`);
    }
  };

  const handleAdminResetPassword = async () => {
    if (!selectedUser || !resetPasswordValue) {
      toast.error("Please enter a new password.");
      return;
    }

    if (selectedUser.role === "admin" && selectedUser.id !== user?.id) {
      toast.error("Administrator cannot change another Administrator's password directly.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/staff/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPasswordValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to reset password.");
        setSaving(false);
        return;
      }

      toast.success(`Password for ${selectedUser.fullName} reset successfully.`);
      setResetOpen(false);
      setSelectedUser(null);
      setResetPasswordValue("");
    } catch {
      toast.error("Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !canManageStaff(role)) {
    return <PageSkeleton rows={6} />;
  }

  const staffUsers = usersList.filter((u) => u.role === "admin" || u.role === "staff");
  const petOwners = usersList.filter((u) => u.role === "owner");

  return (
    <div className="page-container">
      <PageHeader
        title="Staff Management"
        description="Create staff accounts, toggle account statuses, and reset passwords."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Create Staff Account
          </Button>
        }
      />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Accounts ({usersList.length})</TabsTrigger>
          <TabsTrigger value="staff">Clinic Staff ({staffUsers.length})</TabsTrigger>
          <TabsTrigger value="owners">Pet Owners ({petOwners.length})</TabsTrigger>
        </TabsList>

        {["all", "staff", "owners"].map((tabKey) => {
          const displayedUsers =
            tabKey === "staff" ? staffUsers : tabKey === "owners" ? petOwners : usersList;

          return (
            <TabsContent key={tabKey} value={tabKey} className="space-y-4 pt-2">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-0">
                  {loadingUsers ? (
                    <div className="p-8 flex justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-teal" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last Login (PST)</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedUsers.map((account) => (
                          <TableRow key={account.id} className={account.accountStatus === "Deactivated" ? "opacity-60 bg-muted/40" : ""}>
                            <TableCell>
                              <div>
                                <p className="font-semibold text-brand-navy">{account.fullName}</p>
                                {account.phone && <p className="text-xs text-muted-foreground">{account.phone}</p>}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              <span className="font-mono">{account.email}</span>
                              {account.emailVerified ? (
                                <Badge variant="outline" className="ml-2 text-[10px] border-brand-green text-brand-green">Verified</Badge>
                              ) : (
                                <Badge variant="outline" className="ml-2 text-[10px] border-amber-500 text-amber-600">Unverified</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={account.role === "admin" ? "default" : account.role === "staff" ? "secondary" : "outline"} className="capitalize">
                                {roleLabel(account.role)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {account.accountStatus === "Active" ? (
                                <Badge className="bg-brand-green hover:bg-brand-green/90 text-white">Active</Badge>
                              ) : (
                                <Badge variant="destructive">Deactivated</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-muted-foreground">
                              {account.lastLogin ? formatDateTimePH(account.lastLogin) : "Never"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap space-x-1">
                              {/* Toggle Active / Deactivated */}
                              {account.id !== user?.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleStatus(account)}
                                  className={account.accountStatus === "Active" ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-brand-green hover:text-brand-green hover:bg-brand-green-light"}
                                  title={account.accountStatus === "Active" ? "Deactivate Account" : "Reactivate Account"}
                                >
                                  {account.accountStatus === "Active" ? <Ban className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                  {account.accountStatus === "Active" ? "Deactivate" : "Reactivate"}
                                </Button>
                              )}

                              {/* Reset Password */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (account.role === "admin" && account.id !== user?.id) {
                                    toast.error("Administrator cannot change another Administrator's password.");
                                    return;
                                  }
                                  setSelectedUser(account);
                                  setResetPasswordValue("");
                                  setResetOpen(true);
                                }}
                                className="text-brand-teal hover:text-brand-teal hover:bg-brand-teal-light"
                                title="Reset User Password"
                              >
                                <KeyRound className="w-4 h-4 mr-1" /> Reset Pass
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {displayedUsers.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No user accounts found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Create Staff Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">Create New Staff Account</DialogTitle>
            <DialogDescription>
              Create a new clinic staff account. Staff accounts are automatically activated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="staff-fn" className="text-xs">First Name *</Label>
                <Input
                  id="staff-fn"
                  placeholder="Doc"
                  value={staffForm.firstName}
                  onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-mn" className="text-xs">Middle Name</Label>
                <Input
                  id="staff-mn"
                  placeholder="A."
                  value={staffForm.middleName}
                  onChange={(e) => setStaffForm({ ...staffForm, middleName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-ln" className="text-xs">Last Name *</Label>
                <Input
                  id="staff-ln"
                  placeholder="Smith"
                  value={staffForm.lastName}
                  onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="staff-email" className="text-xs">Email Address *</Label>
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="staff@harbourside.com"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="staff-phone" className="text-xs">Phone Number</Label>
                <Input
                  id="staff-phone"
                  placeholder="09171234567"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="staff-pass" className="text-xs">Temporary Password *</Label>
              <Input
                id="staff-pass"
                type="password"
                placeholder="Minimum 8 characters (Upper, lower, number, special char)"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateStaff} disabled={saving} className="bg-brand-navy hover:bg-brand-navy/90 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Create Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Reset Password Modal */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Reset User Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong className="text-foreground">{selectedUser?.fullName}</strong> ({selectedUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-new-pass" className="text-xs font-semibold">New Password *</Label>
              <Input
                id="reset-new-pass"
                type="password"
                placeholder="Enter new password (8+ chars, upper, lower, number, special)"
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdminResetPassword} disabled={saving} className="bg-brand-navy hover:bg-brand-navy/90 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
