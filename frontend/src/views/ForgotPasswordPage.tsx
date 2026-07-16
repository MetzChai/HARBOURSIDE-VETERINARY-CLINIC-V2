"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
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
    setSubmitted(true);
  };

  return (
    <AuthShell
      title="Forgot Password"
      subtitle={
        submitted
          ? "Check your inbox for reset instructions"
          : "Enter your email to receive a reset link"
      }
    >
      <Card className="border border-border shadow-sm">
          <CardContent className="p-6">
            {submitted ? (
              <div className="space-y-5 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-heading font-semibold text-foreground">Email sent</p>
                  <p className="text-sm text-muted-foreground">
                    If an account exists for <span className="font-medium text-foreground">{email}</span>, you'll receive a password reset link shortly.
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2 text-left">
                  <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Didn't get the email? Check your spam folder, or contact the clinic at (02) 1234-5678.</span>
                </div>
                <Button asChild className="w-full h-11 text-sm font-semibold">
                  <Link href="/login">Back to login</Link>
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
                      placeholder="you@harbourside.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      className="pl-10 h-11"
                      maxLength={255}
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center font-medium">{error}</p>
                )}

                <Button type="submit" className="w-full h-11 text-sm font-semibold">
                  Send Reset Link
                </Button>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
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
