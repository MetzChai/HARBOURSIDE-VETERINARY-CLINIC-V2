"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Shield, Calendar, Phone, MapPin, KeyRound } from "lucide-react";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";
import { formatDate } from "@/lib/age";
import { nowPHIso } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db-client";
import { useMyOwner } from "@/hooks/useOwnerData";

type Profile = {
  id: string;
  email: string;
  fullName: string | null;
  role: "admin" | "owner";
  authMethod: "google" | "password";
  createdAt: string;
  contact: string | null;
  address: string | null;
  ownerName: string | null;
  avatarUrl: string | null;
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
      role: (role ?? (portal === "admin" ? "admin" : "owner")) as "admin" | "owner",
      authMethod: "password",
      createdAt: profileRow?.created_at ?? nowPHIso(),
      contact: owner?.contact ?? null,
      address: null,
      ownerName: owner?.name ?? null,
      avatarUrl: null,
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
      toast.error("New passwords do not match");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/auth/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        contact: portal === "owner" ? form.contact : undefined,
        address: portal === "owner" ? form.address : undefined,
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Failed to update profile");
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
    await refreshSession();
    toast.success("Profile updated");
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
        toast.error(err.error ?? "Failed to save profile picture");
        throw new Error(err.error ?? "Failed to save profile picture");
      }
      const data = await res.json();
      setProfile(data.profile);
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(url ? "Profile picture updated" : "Profile picture removed");
    } catch (err) {
      if (err instanceof Error && err.message.includes("Failed to save")) throw err;
      toast.error("Failed to save profile picture");
      throw err;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Could not load your profile.</p>
        <Button variant="outline" onClick={load}>Try again</Button>
      </div>
    );
  }

  const roleLabel = profile.role === "admin" ? "Admin / Staff" : "Pet Owner";
  const authLabel = profile.authMethod === "google" ? "Google (Gmail)" : "Email & Password";

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm">Your personal account information</p>
      </div>

      <Card className="border-0 shadow-sm">
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
          <p className="text-sm text-muted-foreground">
            Click Upload or hover over the photo to change it. Google sign-in can also set your picture automatically.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge>{roleLabel}</Badge>
            <Badge variant="secondary">{authLabel}</Badge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Full Name</p>
              <p className="text-sm font-medium">{profile.fullName || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</p>
              <p className="text-sm font-medium break-all">{profile.email}</p>
            </div>
            {portal === "owner" && (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Contact</p>
                  <p className="text-sm font-medium">{profile.contact || "—"}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</p>
                  <p className="text-sm font-medium">{profile.address || "—"}</p>
                </div>
              </>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Member since</p>
              <p className="text-sm font-medium">{formatDate(profile.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Shield className="h-3 w-3" /> Account type</p>
              <p className="text-sm font-medium">{portal === "admin" ? "Admin Panel" : "Pet Owner Portal"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-heading text-base">Edit Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>

          {portal === "owner" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="+63 900 000 0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Your address"
                />
              </div>
            </>
          )}

          {profile.authMethod === "password" && (
            <div className="pt-2 border-t space-y-4">
              <p className="text-sm font-medium flex items-center gap-1"><KeyRound className="h-4 w-4" /> Change Password</p>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {profile.authMethod === "google" && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              You sign in with Google. Password is managed through your Google account.
            </p>
          )}

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
