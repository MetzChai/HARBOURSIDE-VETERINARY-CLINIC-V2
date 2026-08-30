import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const variantStyles = {
  default: "bg-brand-navy-light text-brand-navy",
  success: "bg-brand-green-light text-brand-green",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  info: "bg-brand-teal-light text-brand-teal",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("border-border/60 shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="font-heading text-2xl font-bold text-brand-navy">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {Icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", variantStyles[variant])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
