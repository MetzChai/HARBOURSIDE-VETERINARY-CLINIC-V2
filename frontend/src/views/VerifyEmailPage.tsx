"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [verifying, setVerifying] = useState(Boolean(token));
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [emailInput, setEmailInput] = useState(emailParam || "");

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (res.ok) {
          setSuccess(true);
          toast.success("Your email has been verified successfully.");
        } else {
          setError(data.error || "Failed to verify email.");
          if (data.email) setEmailInput(data.email);
        }
      } catch {
        setError("An unexpected error occurred during verification.");
      } finally {
        setVerifying(false);
      }
    };

    verify();
  }, [token]);

  const handleResend = async () => {
    if (!emailInput) {
      toast.error("Please provide your email address.");
      return;
    }
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Please check your Gmail to verify your account.");
        setError("");
      } else {
        toast.error(data.error || "Failed to resend verification email.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell title="Email Verification" subtitle="Harbourside Veterinary Clinic">
      <div className="mb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-6 text-center space-y-6">
          {verifying && (
            <div className="py-8 space-y-4">
              <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">Verifying your email address...</p>
            </div>
          )}

          {!verifying && success && (
            <div className="py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Your email has been verified successfully.
              </h3>
              <p className="text-sm text-muted-foreground">
                You can now log in to your account to manage your pet records and appointments.
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                Proceed to Login
              </Button>
            </div>
          )}

          {!verifying && !success && token && error && (
            <div className="py-6 space-y-4">
              <XCircle className="w-16 h-16 text-destructive mx-auto" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Verification Link Expired</h3>
              <p className="text-sm text-muted-foreground">{error}</p>

              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              >
                {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Request New Verification Link"}
              </Button>
            </div>
          )}

          {!verifying && !token && (
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 text-sm">
                <Mail className="h-5 w-5 text-teal-600 shrink-0" />
                <span>Please check your Gmail inbox for the verification link.</span>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  A verification email was sent to your registered Gmail address. Please click the verification button inside the email within <strong>24 hours</strong>.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  onClick={handleResend}
                  disabled={resending}
                  variant="outline"
                  className="w-full h-11 font-medium border-teal-600 text-teal-700 hover:bg-teal-50"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Resend Verification Email"}
                </Button>

                <Button
                  onClick={() => router.push("/login")}
                  className="w-full h-11 bg-slate-800 hover:bg-slate-900 text-white font-medium"
                >
                  Return to Login
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
