"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordChecks = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>_\-\\\/\[\]]/.test(newPassword),
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing password reset token.");
      return;
    }

    if (!Object.values(passwordChecks).every(Boolean)) {
      setError("Password does not meet complexity requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New Password and Confirm Password do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to reset password.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      toast.success("Password changed successfully.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset Your Password" subtitle="Enter a new strong password for your account">
      <div className="mb-4">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-6">
          {success ? (
            <div className="py-6 text-center space-y-5">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  Password changed successfully.
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your password has been updated. You can now sign in with your new password.
                </p>
              </div>
              <Button
                onClick={() => router.push("/login")}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                Proceed to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              {!token && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg text-center font-medium">
                  Invalid or missing password reset link token.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirm New Password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>

              {/* Password criteria */}
              {newPassword && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1 border border-slate-200 dark:border-slate-800">
                  <p className="font-semibold text-muted-foreground mb-1">Password Requirements:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className={`flex items-center gap-1 ${passwordChecks.length ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                      {passwordChecks.length ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />} At least 8 characters
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.uppercase ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                      {passwordChecks.uppercase ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />} 1 uppercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.lowercase ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                      {passwordChecks.lowercase ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />} 1 lowercase letter
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.number ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                      {passwordChecks.number ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />} 1 number
                    </div>
                    <div className={`flex items-center gap-1 ${passwordChecks.special ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                      {passwordChecks.special ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />} 1 special character
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center font-medium">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Reset Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
