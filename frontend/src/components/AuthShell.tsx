import { BrandLogo } from "@/components/BrandLogo";
import { BRAND } from "@/lib/brand-colors";
import { Heart, Shield, Stethoscope } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const highlights = [
  { icon: Stethoscope, text: "Professional veterinary care" },
  { icon: Heart, text: "Compassionate pet wellness" },
  { icon: Shield, text: "Secure patient records" },
];

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="min-h-screen flex">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-sidebar flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-navy to-brand-teal/70" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-teal/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-green/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
          <svg viewBox="0 0 1440 120" className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path
              fill={BRAND.navy}
              d="M0,64 C360,120 720,0 1080,48 C1260,72 1380,96 1440,80 L1440,120 L0,120 Z"
            />
            <path
              fill={BRAND.teal}
              d="M0,88 C480,40 960,100 1440,64 L1440,120 L0,120 Z"
            />
            <path
              fill={BRAND.green}
              fillOpacity="0.5"
              d="M0,100 C360,80 720,110 1080,90 C1260,82 1380,95 1440,88 L1440,120 L0,120 Z"
            />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-md">
          <BrandLogo size="xl" />
          <h1 className="font-heading text-3xl font-bold text-white mt-8">
            Harbourside Veterinary Clinic
          </h1>
          <p className="text-white/75 mt-3 text-sm leading-relaxed">
            Compassionate, professional care for your beloved companions
          </p>
          <ul className="mt-10 space-y-3 text-left w-full">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-white/80 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-4 w-4 text-brand-teal" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-brand-navy-light/30">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex flex-col items-center mb-8 lg:items-start lg:mb-6">
            <div className="lg:hidden mb-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-brand-navy">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground text-sm mt-1 text-center lg:text-left">{subtitle}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
