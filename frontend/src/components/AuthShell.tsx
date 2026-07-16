import { BrandLogo } from "@/components/BrandLogo";

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthShell({ children, title, subtitle }: AuthShellProps) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 bg-sidebar flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-navy via-brand-navy to-brand-teal/80" />
        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden">
          <svg viewBox="0 0 1440 120" className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path
              fill="#1B3A5C"
              d="M0,64 C360,120 720,0 1080,48 C1260,72 1380,96 1440,80 L1440,120 L0,120 Z"
            />
            <path
              fill="#1FA8A8"
              d="M0,88 C480,40 960,100 1440,64 L1440,120 L0,120 Z"
            />
            <path
              fill="#3CB043"
              fillOpacity="0.5"
              d="M0,100 C360,80 720,110 1080,90 C1260,82 1380,95 1440,88 L1440,120 L0,120 Z"
            />
          </svg>
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <BrandLogo size="xl" />
          <h1 className="font-heading text-3xl font-bold text-white mt-8">Harbourside Veterinary</h1>
          <p className="text-white/75 mt-3 max-w-sm text-sm leading-relaxed">
            Compassionate, professional care for your beloved companions
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="flex flex-col items-center mb-8 lg:items-start lg:mb-6">
            <div className="lg:hidden mb-4">
              <BrandLogo size="lg" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
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
