"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
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

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const authError = new URLSearchParams(window.location.search).get("error");
    const messages: Record<string, string> = {
      google_not_configured: "Google login is not configured on the server.",
      google_auth_failed: "Google sign-in failed. Please try again.",
      google_no_email: "Your Google account has no email address.",
      google_email_unverified: "Please verify your Gmail address with Google first.",
      google_gmail_only: "New Google sign-ups require a verified @gmail.com account.",
      google_state_invalid: "Sign-in session expired. Please try Google again.",
    };
    if (authError && messages[authError]) setError(messages[authError]);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: signInError } = await authClient.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      if (signInError?.code === "EMAIL_NOT_VERIFIED") {
        setError("Please verify your Gmail with Google before signing in.");
        setLoading(false);
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      if (signInError?.code === "GOOGLE_ONLY") {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      setError(signInError?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", data.user.id);
    const isAdmin = ((roles as { role: string }[]) ?? []).some((r) => r.role === "admin");
    await refreshSession();
    router.push(isAdmin ? "/admin" : "/user");
  };

  return (
    <AuthShell title="Harbourside Veterinary" subtitle="Sign in to your account">
      <Card className="border border-border shadow-sm">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    className="pl-10 h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    className="pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3 text-center font-medium">{error}</p>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
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

              <div className="text-left">
                <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Forgot password?
                </Link>
              </div>

              <p className="text-sm text-center text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
    </AuthShell>
  );
}
