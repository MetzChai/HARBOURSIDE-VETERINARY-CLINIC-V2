/** Harbourside brand palette derived from the clinic logo */
export const BRAND = {
  red: "#E5192C",
  crimson: "#7F1D1D",
  navy: "#7F1D1D",
  teal: "#E5192C",
  green: "#16A34A",
  charcoal: "#2D3436",
  navyLight: "#FEE2E2",
  tealLight: "#FFF1F2",
  greenLight: "#EDF7ED",
  amber: "#E65100",
} as const;

/** Chart palette for Recharts and analytics */
export const CHART_COLORS = [
  BRAND.red,
  BRAND.crimson,
  BRAND.green,
  "#8E24AA",
  BRAND.amber,
  "#D97706",
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
