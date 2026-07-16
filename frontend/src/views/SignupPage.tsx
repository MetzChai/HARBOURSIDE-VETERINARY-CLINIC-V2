"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, Loader2 } from "lucide-react";
import { authClient, db } from "@/lib/db-client";
import { useAuth } from "@/hooks/useAuth";
import { AuthShell } from "@/components/AuthShell";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function isGmailAddress(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain === "gmail.com" || domain === "googlemail.com";
}

export default function SignupPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    contact: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const { fullName, email, contact, password, confirmPassword } = form;
    if (!fullName || !email || !contact || !password) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!isGmailAddress(email)) {
      setError("Pet owner registration requires a @gmail.com address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await authClient.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, contact },
      },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    if (data.needsVerification) {
      toast({
        title: "Account created",
        description: "Verify your Gmail with Google before signing in.",
      });
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      setLoading(false);
      return;
    }
    if (data.session) {
      await db.from("owners").update({ contact }).eq("user_id", data.user!.id);
    }
    toast({
      title: "Account created",
      description: data.session
        ? `Welcome, ${fullName}!`
        : `Welcome, ${fullName}! Please sign in to continue.`,
    });
    await refreshSession();
    router.push(data.session ? "/user" : "/login");
  };

  return (
    <AuthShell title="Create your account" subtitle="Join the Harbourside pet owner portal">
      <div className="mb-4">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>

      <Card className="border border-border shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-name" placeholder="Jane Doe" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="pl-10 h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gmail Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-email" type="email" placeholder="you@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="pl-10 h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-contact" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-contact" placeholder="+63 900 000 0000" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="pl-10 h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-password" type={showPassword ? "text" : "password"} placeholder="At least 6 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pl-10 pr-10 h-11" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-confirm" type={showPassword ? "text" : "password"} placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="pl-10 h-11" />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center font-medium">{error}</p>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-sm font-medium"
                onClick={() => { window.location.href = "/api/auth/google"; }}
              >
                <GoogleIcon />
                <span className="ml-2">Continue with Google</span>
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
    </AuthShell>
  );
}
