"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to process password reset.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
      toast.success("A password reset link has been sent to your Gmail.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot Password"
      subtitle={
        submitted
          ? "Check your Gmail for password reset instructions"
          : "Enter your email to receive a password reset link"
      }
    >
      <Card className="border border-border shadow-sm">
        <CardContent className="p-6">
          {submitted ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-teal-100 dark:bg-teal-950 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Reset Email Sent</h3>
                <p className="text-sm text-muted-foreground">
                  A password reset link has been sent to your Gmail address <strong className="text-foreground">{email}</strong>.
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 text-left border border-amber-200 dark:border-amber-800">
                <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>Notice:</strong> The password reset link will expire after <strong>30 minutes</strong>.</span>
              </div>

              <Button asChild className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white">
                <Link href="/login">Back to Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    className="pl-10 h-11"
                    maxLength={255}
                    required
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center font-medium">{error}</p>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Send Reset Link"}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors pt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
