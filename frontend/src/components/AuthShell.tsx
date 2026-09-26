import { BrandLogo } from "@/components/BrandLogo";
import { Heart, Shield, Sparkles, Stethoscope, Award, Activity } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const highlights = [
  {
    icon: Stethoscope,
    title: "Professional Veterinary Care",
    text: "Certified veterinary specialists & comprehensive check-ups",
  },
  {
    icon: Heart,
    title: "Compassionate Pet Wellness",
    text: "Dedicated treatment & preventative care tailored for your pets",
  },
  {
    icon: Shield,
    title: "Secure Digital Patient Records",
    text: "Instant access to medical history, lab records & prescriptions",
  },
];

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Dynamic Branding Hero Panel */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] flex-col items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-[#3B070B] via-[#7F1D1D] to-[#450A0E] select-none">

        {/* Background Mesh Gradients & Orbs */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(244,63,94,0.25),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(190,18,60,0.3),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-rose-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />

        {/* Decorative Wave Bottom Graphic */}
        <div className="absolute bottom-0 left-0 right-0 h-28 opacity-25">
          <svg viewBox="0 0 1440 120" className="absolute bottom-0 w-full h-full" preserveAspectRatio="none">
            <path
              fill="#ffffff"
              d="M0,32 C320,96 640,0 960,48 C1120,72 1280,96 1440,64 L1440,120 L0,120 Z"
            />
          </svg>
        </div>

        {/* Main Content Box */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg">

          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-semibold backdrop-blur-md shadow-md mb-8">
            <Sparkles className="h-3.5 w-3.5 text-rose-300 animate-pulse" />
            <span>Trusted Veterinary Care & Patient Management</span>
          </div>

          {/* Logo Container with Glassmorphism */}
          <div className="transform transition-transform duration-500 hover:scale-105">
            <BrandLogo size="xl" />
          </div>

          <h1 className="font-heading text-3xl xl:text-4xl font-extrabold text-white tracking-tight mt-6 leading-tight">
            Harbourside <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-white to-rose-300">Veterinary Clinic</span>
          </h1>

          <p className="text-white/80 mt-3 text-sm leading-relaxed max-w-md font-normal">
            Compassionate, state-of-the-art medical care and personalized wellness for your beloved companions.
          </p>

          {/* Feature Highlight Cards */}
          <div className="mt-8 space-y-3.5 text-left w-full">
            {highlights.map(({ icon: Icon, title: hTitle, text }) => (
              <div
                key={hTitle}
                className="group flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-white/30 shadow-lg shadow-black/10"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-red-600 text-white shadow-md group-hover:scale-110 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-xs leading-tight">{hTitle}</h4>
                  <p className="text-white/70 text-[11px] mt-0.5 leading-snug">{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Stats Pill */}
          <div className="mt-8 flex items-center justify-center gap-6 text-white/70 text-xs font-medium border-t border-white/15 pt-6 w-full">
            <div className="flex items-center gap-1.5">
              <Award className="h-4 w-4 text-rose-300" />
              <span>Certified Vets</span>
            </div>
            <div className="h-3 w-px bg-white/20" />
            <div className="flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-rose-300" />
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-slate-50 border-l border-slate-200">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8 lg:items-start lg:mb-6">
            <div className="lg:hidden mb-5">
              <BrandLogo size="lg" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-[#1B3A5C] tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-slate-500 text-sm mt-1 text-center lg:text-left">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
