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
      <Image
        src="/logo.png"
        alt="Harbourside Veterinary Clinic"
        width={px}
        height={px}
        className="object-contain shrink-0"
        priority
      />
      {showText && !collapsed && (
        <div>
          <h2
            className={cn(
              "font-heading font-bold leading-tight",
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
