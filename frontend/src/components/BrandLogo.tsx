import Image from "next/image";
import { cn } from "@/lib/utils";

const sizes = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
} as const;

type BrandLogoSize = keyof typeof sizes;

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  showText?: boolean;
  subtitle?: string;
  variant?: "default" | "sidebar";
  collapsed?: boolean;
}

export function BrandLogo({
  size = "md",
  className,
  showText = false,
  subtitle,
  variant = "default",
  collapsed = false,
}: BrandLogoProps) {
  const px = sizes[size];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center shrink-0 rounded-2xl transition-all duration-300 hover:scale-105",
          size === "xl"
            ? "p-3.5 bg-gradient-to-br from-white/25 via-white/15 to-white/5 border border-white/30 shadow-2xl backdrop-blur-xl ring-4 ring-white/15 shadow-rose-950/50"
            : size === "lg"
            ? "p-2 bg-white/15 border border-white/20 shadow-md backdrop-blur-md"
            : "p-1 bg-white/10 border border-white/15"
        )}
      >
        <Image
          src="/logo.png"
          alt="Harbourside Veterinary Clinic"
          width={px}
          height={px}
          className="object-contain shrink-0 rounded-xl"
          priority
        />
      </div>
      {showText && !collapsed && (
        <div>
          <h2
            className={cn(
              "font-heading font-bold leading-tight tracking-tight",
              variant === "sidebar" ? "text-sidebar-accent-foreground" : "text-foreground",
              size === "xl" ? "text-2xl" : "text-sm",
            )}
          >
            Harbourside
          </h2>
          {subtitle && (
            <p
              className={cn(
                "text-xs",
                variant === "sidebar" ? "text-sidebar-foreground/60" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
