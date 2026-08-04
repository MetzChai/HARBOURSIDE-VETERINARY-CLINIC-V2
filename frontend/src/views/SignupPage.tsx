"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Check,
} from "lucide-react";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

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

type FieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
  general?: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const passwordChecks = {
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[!@#$%^&*(),.?":{}|<>_\-\\\/\[\]]/.test(form.password),
  };

  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    if (!form.firstName.trim()) {
      errors.firstName = "First Name is required.";
    }

    if (!form.lastName.trim()) {
      errors.lastName = "Last Name is required.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim()) {
      errors.email = "Email Address is required.";
    } else if (!emailRegex.test(form.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    const phPhoneRegex = /^(09|\+639)\d{9}$/;
    if (!form.phone.trim()) {
      errors.phone = "Contact Number is required.";
    } else if (!phPhoneRegex.test(form.phone.replace(/\s+/g, ""))) {
      errors.phone = "Please enter a valid Philippine mobile number (e.g. 09171234567).";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    } else if (!Object.values(passwordChecks).every(Boolean)) {
      errors.password = "Password does not meet the security requirements.";
    }

    if (!form.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (form.password !== form.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (!acceptTerms) {
      errors.terms = "Please accept the Terms of Service.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error && data.error.toLowerCase().includes("already exists")) {
          setFieldErrors({ email: "This email is already registered." });
        } else {
          setFieldErrors({ general: data.error || "Registration failed." });
        }
        setLoading(false);
        return;
      }

      setRegisteredEmail(form.email.trim());
      setIsSuccess(true);
      toast.success("Please check your email to verify your account.");
    } catch {
      setFieldErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!registeredEmail) return;
    setResending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Verification email has been resent to " + registeredEmail);
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
    <AuthShell
      title={isSuccess ? "Registration Successful" : "Create Your Account"}
      subtitle={isSuccess ? "One last step before signing in" : "Join Harbourside Veterinary Clinic Pet Record System"}
    >
      <div className="mb-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 rounded"
        >
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>

      <Card className="border border-border shadow-sm">
        <CardContent className="p-6">
          {isSuccess ? (
            /* Registration Success Screen */
            <div className="py-6 text-center space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  ✔ Registration Successful
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  We&apos;ve sent a verification email to{" "}
                  <strong className="text-slate-800 dark:text-slate-200">{registeredEmail}</strong>. Please verify your account before signing in.
                </p>
              </div>

              <div className="p-4 bg-teal-50 dark:bg-teal-950/40 rounded-lg text-xs text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 text-left space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <Info className="w-4 h-4 text-teal-600 shrink-0" /> Important Notice:
                </p>
                <p className="pl-5">
                  The verification link will expire after <strong>24 hours</strong>. If you do not see the email in your inbox, please check your spam or junk folder.
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <Button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={resending}
                  variant="outline"
                  className="w-full h-11 text-sm font-semibold border-teal-600 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950"
                >
                  {resending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Resend Verification Email
                </Button>

                <Button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white"
                >
                  Back to Login
                </Button>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form onSubmit={handleSignup} className="space-y-4" noValidate>
              {fieldErrors.general && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg text-center font-medium">
                  {fieldErrors.general}
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="Juan"
                      value={form.firstName}
                      onChange={(e) => {
                        setForm({ ...form, firstName: e.target.value });
                        if (fieldErrors.firstName) setFieldErrors({ ...fieldErrors, firstName: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.firstName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.firstName && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.firstName}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="middleName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Middle Name <span className="text-xs text-muted-foreground font-normal"></span>
                  </Label>
                  <Input
                    id="middleName"
                    placeholder="Santos"
                    value={form.middleName}
                    onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                    className="h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Dela Cruz"
                    value={form.lastName}
                    onChange={(e) => {
                      setForm({ ...form, lastName: e.target.value });
                      if (fieldErrors.lastName) setFieldErrors({ ...fieldErrors, lastName: undefined });
                    }}
                    className={`h-10 ${fieldErrors.lastName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Email & Contact Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact Number <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      placeholder="Example: 09171234567"
                      value={form.phone}
                      onChange={(e) => {
                        setForm({ ...form, phone: e.target.value });
                        if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.phone && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Multi-line Address Textarea */}
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Address <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Textarea
                    id="address"
                    placeholder="Enter your complete address (e.g. Street, Barangay, City, Province)"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="pl-10 min-h-[70px] resize-y"
                    rows={2}
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={form.password}
                      onChange={(e) => {
                        setForm({ ...form, password: e.target.value });
                        if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                      }}
                      className={`pl-10 pr-10 h-10 ${fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Confirm Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={form.confirmPassword}
                      onChange={(e) => {
                        setForm({ ...form, confirmPassword: e.target.value });
                        if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: undefined });
                      }}
                      className={`pl-10 h-10 ${fieldErrors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p className="text-xs text-destructive font-medium mt-1">{fieldErrors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Password Requirements Live Checklist */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1.5 border border-slate-200 dark:border-slate-800">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Password Requirements</p>
                <div className="space-y-1 text-muted-foreground">
                  <div className={`flex items-center gap-1.5 ${passwordChecks.length ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {passwordChecks.length ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 text-center text-slate-400">•</span>}
                    Minimum of 8 characters
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.uppercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {passwordChecks.uppercase ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 text-center text-slate-400">•</span>}
                    At least one uppercase letter
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.lowercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {passwordChecks.lowercase ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 text-center text-slate-400">•</span>}
                    At least one lowercase letter
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.number ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {passwordChecks.number ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 text-center text-slate-400">•</span>}
                    At least one number
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordChecks.special ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}`}>
                    {passwordChecks.special ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <span className="w-3.5 text-center text-slate-400">•</span>}
                    At least one special character
                  </div>
                </div>
              </div>

              {/* Email Verification Informational Notice */}
              <div className="p-3 bg-teal-50/80 dark:bg-teal-950/40 rounded-lg text-xs text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <span>
                  After registration, a verification email will be sent to your email address. You must verify your account before signing in.
                </span>
              </div>

              {/* Terms and Privacy Policy */}
              <div className="space-y-1 pt-1">
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => {
                      setAcceptTerms(Boolean(checked));
                      if (fieldErrors.terms) setFieldErrors({ ...fieldErrors, terms: undefined });
                    }}
                    className="mt-0.5"
                  />
                  <Label htmlFor="terms" className="text-xs text-muted-foreground leading-normal cursor-pointer">
                    I have read and agree to the{" "}
                    <span className="text-teal-600 dark:text-teal-400 font-medium underline hover:text-teal-700">
                      Terms of Service
                    </span>{" "}
                    and{" "}
                    <span className="text-teal-600 dark:text-teal-400 font-medium underline hover:text-teal-700">
                      Privacy Policy
                    </span>
                    .
                  </Label>
                </div>
                {fieldErrors.terms && (
                  <p className="text-xs text-destructive font-medium pl-6">{fieldErrors.terms}</p>
                )}
              </div>

              {/* Submit Register Button */}
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Register Account"
                )}
              </Button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Google OAuth Sign-In Button */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 text-sm font-medium border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => {
                  window.location.href = "/api/auth/google";
                }}
                disabled={loading}
              >
                <GoogleIcon />
                <span className="ml-2">Continue with Google</span>
              </Button>

              <div className="text-center text-sm text-muted-foreground pt-1">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-teal-600 hover:text-teal-700 dark:text-teal-400 font-semibold underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded"
                >
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
