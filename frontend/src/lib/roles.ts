export type AppRole = "admin" | "staff" | "owner";

export function isClinicUser(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "staff";
}

export function isAdmin(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

export function canManageStaff(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

export function canViewReports(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

export function canManageInventoryItems(role: AppRole | null | undefined): boolean {
  return role === "admin";
}

export function canRecordStockUsage(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "staff";
}

export function resolvePrimaryRole(roles: string[]): AppRole | null {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  if (roles.includes("owner")) return "owner";
  return null;
}

export function roleLabel(role: AppRole): string {
  switch (role) {
    case "admin":
      return "System Administrator";
    case "staff":
      return "Receptionist / Veterinary Staff";
    case "owner":
      return "Pet Owner";
  }
}
