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

  const { data: fetchedProfile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/auth/profile", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch profile");
      }
      const data = await res.json();
      return data.profile as Profile;
    },
  });

  const profile = fetchedProfile ?? buildFallbackProfile();

  useEffect(() => {
    if (profile) {
      setForm((prev) => ({
        ...prev,
        firstName: profile.firstName ?? "",
        middleName: profile.middleName ?? "",
        lastName: profile.lastName ?? "",
        fullName: profile.fullName ?? "",
        contact: profile.contact ?? "",
        address: profile.address ?? "",
      }));
    }
  }, [profile?.id, profile?.fullName, profile?.firstName, profile?.lastName, profile?.contact, profile?.address]);

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
    setForm((f) => ({
      ...f,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }));
    await refreshSession();
    await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    await queryClient.invalidateQueries({ queryKey: ["my-owner"] });
    await queryClient.invalidateQueries({ queryKey: ["owners"] });
    await queryClient.invalidateQueries({ queryKey: ["profile-row"] });
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
      await refreshSession();
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["my-owner"] });
      await queryClient.invalidateQueries({ queryKey: ["owners"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-row"] });
      toast.success(url ? "Profile picture updated successfully." : "Profile picture removed.");
    } catch (err) {
      if (err instanceof Error && err.message.includes("Failed to save")) throw err;
      toast.error("Failed to save profile picture.");
      throw err;
    }
  };

  if (authLoading || (profileLoading && !profile)) {
    return <PageSkeleton rows={4} />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-muted-foreground">Could not load your profile.</p>
        <Button variant="outline" onClick={() => refetchProfile()}>Try again</Button>
      </div>
    );
  }

  const roleLabelText = profile.role ? roleLabel(profile.role) : "User";
  const authLabel = profile.authMethod === "google" ? "Google (Gmail)" : "Email & Password";

  const [heroImgError, setHeroImgError] = useState(false);

  useEffect(() => {
    setHeroImgError(false);
  }, [profile?.avatarUrl]);

  return (
    <div className="page-container w-full max-w-7xl space-y-6 pb-10">
      {/* Harbourside Branded Hero Profile Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4A0A10] via-[#7F1D1D] to-[#E5192C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-2xl bg-white/10 border-2 border-white/30 flex items-center justify-center font-heading font-extrabold text-white text-3xl shadow-inner backdrop-blur-md overflow-hidden shrink-0">
              {profile.avatarUrl && !heroImgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setHeroImgError(true)}
                />
              ) : (
                (profile.fullName ?? profile.email)[0]?.toUpperCase() ?? "?"
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-white">
                  {profile.fullName || "My Account"}
                </h1>
                <Badge className="bg-[#E5192C] text-white font-semibold border border-rose-300/30">
                  {roleLabelText}
                </Badge>
              </div>
              <p className="text-xs text-slate-200/90 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-brand-teal" /> {profile.email}
              </p>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-200">
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3 text-brand-teal" /> Member since {formatDatePH(profile.createdAt)}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 text-brand-teal" /> Last Login: {formatDateTimePH(profile.lastLogin)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
            <Badge variant="outline" className="bg-white/10 text-white border-white/20 px-3 py-1.5 backdrop-blur-md text-xs font-semibold">
              <Shield className="h-3.5 w-3.5 mr-1 text-brand-teal" /> {authLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Wide 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (lg:col-span-4): Avatar & Overview Cards */}
        <div className="lg:col-span-4 space-y-6">
          {/* Profile Picture Card */}
          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/60 border-b">
              <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                <User className="h-4 w-4 text-[#1FA8A8]" /> Profile Avatar
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-center">
              <div className="flex justify-center">
                <ImageUpload
                  currentImage={profile.avatarUrl ?? undefined}
                  fallback={(profile.fullName ?? profile.email)[0]?.toUpperCase() ?? "?"}
                  folder="avatars"
                  size="lg"
                  showUploadToast={false}
                  onImageUploaded={saveAvatarUrl}
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload a custom profile photo or use your default Google account avatar.
              </p>
            </CardContent>
          </Card>

          {/* Account Badges & Security Summary Card */}
          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/60 border-b">
              <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#1FA8A8]" /> Security & Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs py-1.5 border-b">
                  <span className="text-muted-foreground">Account Role</span>
                  <Badge className="bg-[#1B3A5C] text-white font-semibold">{roleLabelText}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b">
                  <span className="text-muted-foreground">Authentication Method</span>
                  <Badge variant="outline" className="border-[#1FA8A8]/30 bg-[#E8F6F6] text-[#1B3A5C] font-semibold">{authLabel}</Badge>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b">
                  <span className="text-muted-foreground">Email Verification</span>
                  {profile.emailVerified ? (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-bold">Verified</Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Unverified</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs py-1.5 border-b">
                  <span className="text-muted-foreground">Registered On</span>
                  <span className="font-medium text-[#1B3A5C]">{formatDatePH(profile.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1.5">
                  <span className="text-muted-foreground">Last Session (PHT)</span>
                  <span className="font-semibold text-[#1FA8A8] text-[11px]">{formatDateTimePH(profile.lastLogin)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Main Column (lg:col-span-8): Form & Activity */}
        <div className="lg:col-span-8 space-y-6">
          {/* Edit Profile Form Card */}
          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/60 border-b">
              <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                <User className="h-4 w-4 text-[#1FA8A8]" /> Edit Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-bold text-[#1B3A5C]">First Name</Label>
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    placeholder="e.g. Juan"
                    className="focus-visible:ring-[#1FA8A8]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="middleName" className="text-xs font-bold text-[#1B3A5C]">Middle Name</Label>
                  <Input
                    id="middleName"
                    value={form.middleName}
                    onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                    placeholder="e.g. Santos"
                    className="focus-visible:ring-[#1FA8A8]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-bold text-[#1B3A5C]">Last Name</Label>
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    placeholder="e.g. Dela Cruz"
                    className="focus-visible:ring-[#1FA8A8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact" className="text-xs font-bold text-[#1B3A5C]">Contact Number</Label>
                  <Input
                    id="contact"
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    placeholder="e.g. 09171234567"
                    className="focus-visible:ring-[#1FA8A8]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emailReadonly" className="text-xs font-bold text-[#1B3A5C]">Email Address (Account ID)</Label>
                  <Input
                    id="emailReadonly"
                    value={profile.email}
                    disabled
                    className="bg-slate-100 text-slate-600 font-mono text-xs cursor-not-allowed border-slate-200"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-bold text-[#1B3A5C]">Full Complete Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Street, Barangay, City, Province"
                  className="focus-visible:ring-[#1FA8A8]"
                />
              </div>

              {profile.authMethod === "password" && (
                <div className="pt-4 border-t space-y-4">
                  <p className="text-sm font-bold text-[#1B3A5C] flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-[#1FA8A8]" /> Change Account Password
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword" className="text-xs">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={form.currentPassword}
                      onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={form.newPassword}
                        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-xs">Confirm New Password</Label>
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
                <p className="text-xs text-muted-foreground border-t pt-3 bg-slate-50 p-3 rounded-lg border">
                  🔒 This account is authenticated via <strong>Google OAuth</strong>. Password management and security verifications are handled through your Google account.
                </p>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={save} disabled={saving} className="bg-[#1B3A5C] hover:bg-[#152e4a] text-white font-semibold text-xs px-6 shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Save Profile Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Login History Table */}
          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/60 border-b">
              <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                <History className="h-4 w-4 text-[#1FA8A8]" /> Recent Login History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {profile.loginHistory && profile.loginHistory.length > 0 ? (
                <div className="data-table-wrap border-0 shadow-none">
                  <div className="bg-[#E8EEF4] p-3 grid grid-cols-3 font-bold text-xs text-[#1B3A5C] border-b">
                    <span>Date & Time (Asia/Manila)</span>
                    <span>Login Method</span>
                    <span>IP Address</span>
                  </div>
                  <div className="divide-y divide-border text-xs">
                    {profile.loginHistory.map((item) => (
                      <div key={item.id} className="p-3 grid grid-cols-3 items-center hover:bg-slate-50 transition-colors">
                        <span className="font-medium text-slate-800">{formatDateTimePH(item.loginTime)}</span>
                        <span>
                          <Badge variant={item.loginMethod === "Google" ? "secondary" : "outline"} className="text-[10px] font-semibold">
                            {item.loginMethod}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground font-mono">{item.ipAddress || "Local"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No recent login activity recorded.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
