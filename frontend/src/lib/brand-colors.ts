/** Harbourside brand palette derived from the clinic logo */
export const BRAND = {
  navy: "#1B3A5C",
  teal: "#1FA8A8",
  green: "#3CB043",
  charcoal: "#2D3436",
  navyLight: "#E8EEF4",
  tealLight: "#E8F6F6",
  greenLight: "#EDF7ED",
  amber: "#E65100",
  red: "#C62828",
} as const;

/** Chart palette for Recharts and analytics */
export const CHART_COLORS = [
  BRAND.navy,
  BRAND.teal,
  BRAND.green,
  "#8E24AA",
  BRAND.amber,
  BRAND.red,
] as const;

/** Inventory status badge classes */
export const INVENTORY_STATUS_STYLES: Record<string, string> = {
  available: "bg-brand-green-light text-brand-green border-brand-green/30",
  "expiring soon": "bg-amber-50 text-amber-800 border-amber-300",
  expired: "bg-red-50 text-red-800 border-red-300",
  "out of stock": "bg-brand-charcoal/10 text-brand-charcoal border-brand-charcoal/20",
};

export function getInventoryStatusClass(status?: string | null): string {
  const key = String(status ?? "").toLowerCase();
  return INVENTORY_STATUS_STYLES[key] ?? "bg-muted text-muted-foreground border-border";
}
