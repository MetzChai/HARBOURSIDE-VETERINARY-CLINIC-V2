"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Shield, Calendar, Phone, MapPin, KeyRound, Clock, History } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";
import { formatDatePH, formatDateTimePH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";
import { roleLabel, type AppRole } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { useMyOwner } from "@/hooks/useOwnerData";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

type LoginHistoryItem = {
  id: string;
  loginMethod: string;
  loginTime: string | null;
  ipAddress: string | null;
};

type Profile = {
  id: string;
  email: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fullName: string | null;
  role: AppRole;
  authMethod: "google" | "password";
  createdAt: string;
  lastLogin?: string | null;
  contact: string | null;
  address: string | null;
  ownerName: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  loginHistory?: LoginHistoryItem[];
};

interface Props {
  portal: "admin" | "owner";
}

export default function ManageProfile({ portal }: Props) {
  const { user, role, loading: authLoading, refreshSession } = useAuth();
  const { data: owner } = useMyOwner();
  const queryClient = useQueryClient();

  const { data: profileRow } = useQuery({
    queryKey: ["profile-row", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await db.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data as { full_name?: string; email?: string; created_at?: string } | null;
    },
  });

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    fullName: "",
    contact: "",
    address: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const buildFallbackProfile = useCallback((): Profile | null => {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      fullName: profileRow?.full_name ?? user.user_metadata?.full_name ?? owner?.name ?? null,
      role: (role ?? (portal === "admin" ? "staff" : "owner")) as AppRole,
      authMethod: "password",
      createdAt: profileRow?.created_at ?? new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      contact: owner?.contact ?? null,
      address: null,
      ownerName: owner?.name ?? null,
      avatarUrl: null,
      emailVerified: true,
      loginHistory: [],
    };
  }, [user, role, portal, profileRow, owner]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const p = data.profile as Profile;
        setProfile(p);
        setForm({
          firstName: p.firstName ?? "",
          middleName: p.middleName ?? "",
          lastName: p.lastName ?? "",
          fullName: p.fullName ?? "",
          contact: p.contact ?? "",
          address: p.address ?? "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const fallback = buildFallbackProfile();
        if (fallback) {
          setProfile(fallback);
          setForm({
            firstName: "",
            middleName: "",
            lastName: "",
            fullName: fallback.fullName ?? "",
            contact: fallback.contact ?? "",
            address: fallback.address ?? "",
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
        }
      }
    } catch {
      const fallback = buildFallbackProfile();
      if (fallback) {
        setProfile(fallback);
        setForm({
          firstName: "",
          middleName: "",
          lastName: "",
          fullName: fallback.fullName ?? "",
          contact: fallback.contact ?? "",
          address: fallback.address ?? "",
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      }
    }
    setLoading(false);
  }, [user, buildFallbackProfile]);

  useEffect(() => {
    if (!authLoading && user) {
      load();
    }
  }, [authLoading, user, load]);

  const save = async () => {
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName || undefined,
        middleName: form.middleName || undefined,
        lastName: form.lastName || undefined,
        fullName: form.fullName || undefined,
        contact: form.contact || undefined,
        address: form.address || undefined,
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to update profile.");
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
    await refreshSession();
    toast.success("Profile updated successfully.");
  };

  const saveAvatarUrl = async (url: string) => {
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Failed to save profile picture.");
        throw new Error(err.error ?? "Failed to save profile picture.");
      }
      const data = await res.json();
      setProfile(data.profile);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(url ? "Profile picture updated successfully." : "Profile picture removed.");
    } catch (err) {
      if (err instanceof Error && err.message.includes("Failed to save")) throw err;
      toast.error("Failed to save profile picture.");
      throw err;
    }
  };

  if (authLoading || loading) {
    return <PageSkeleton rows={4} />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Could not load your profile.</p>
        <Button variant="outline" onClick={load}>Try again</Button>
      </div>
    );
  }

  const roleLabelText = profile.role ? roleLabel(profile.role) : "User";
  const authLabel = profile.authMethod === "google" ? "Google (Gmail)" : "Email & Password";

  return (
    <div className="page-container max-w-3xl">
      <PageHeader
        title="My Profile"
        description="Manage your personal account details and security settings"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Profile Picture</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ImageUpload
            currentImage={profile.avatarUrl ?? undefined}
            fallback={(profile.fullName ?? profile.email)[0]?.toUpperCase() ?? "?"}
            folder="avatars"
            size="lg"
            showUploadToast={false}
            onImageUploaded={saveAvatarUrl}
          />
          <p className="text-xs text-muted-foreground">
            Click Upload to upload a custom avatar or use your Google Profile picture.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <User className="h-4 w-4 text-brand-teal" /> Account Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-brand-navy text-white">{roleLabelText}</Badge>
            <Badge variant="secondary">{authLabel}</Badge>
            {profile.emailVerified && <Badge variant="outline" className="border-brand-green text-brand-green">Verified Gmail</Badge>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Full Name</p>
              <p className="text-sm font-medium">{profile.fullName || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email Address</p>
              <p className="text-sm font-medium break-all">{profile.email}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Contact Number</p>
              <p className="text-sm font-medium">{profile.contact || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</p>
              <p className="text-sm font-medium">{profile.address || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Account Created</p>
              <p className="text-sm font-medium">{formatDatePH(profile.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3 text-brand-teal" /> Last Login (Asia/Manila)</p>
              <p className="text-sm font-semibold text-brand-navy">{formatDateTimePH(profile.lastLogin)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Edit Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Juan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                placeholder="Santos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Dela Cruz"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Number</Label>
              <Input
                id="contact"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="09171234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emailReadonly">Email Address</Label>
              <Input
                id="emailReadonly"
                value={profile.email}
                disabled
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">Email address cannot be changed directly. Email verification is required for email changes.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full address"
            />
          </div>

          {profile.authMethod === "password" && (
            <div className="pt-3 border-t space-y-4">
              <p className="text-sm font-semibold flex items-center gap-1.5"><KeyRound className="h-4 w-4 text-brand-teal" /> Change Password</p>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    placeholder="Minimum 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>
            </div>
          )}

          {profile.authMethod === "google" && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              This account uses Google OAuth sign-in. Your password is managed securely via Google.
            </p>
          )}

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Login History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <History className="h-4 w-4 text-brand-teal" /> Recent Login History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {profile.loginHistory && profile.loginHistory.length > 0 ? (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden text-xs">
              <div className="bg-muted/50 p-2.5 grid grid-cols-3 font-semibold text-muted-foreground">
                <span>Date & Time (Asia/Manila)</span>
                <span>Login Method</span>
                <span>IP Address</span>
              </div>
              {profile.loginHistory.map((item) => (
                <div key={item.id} className="p-2.5 grid grid-cols-3 items-center">
                  <span className="font-medium">{formatDateTimePH(item.loginTime)}</span>
                  <span>
                    <Badge variant={item.loginMethod === "Google" ? "secondary" : "outline"} className="text-[10px]">
                      {item.loginMethod}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground font-mono">{item.ipAddress || "Local"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No recent login activity recorded.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
