export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "STAFF_FOLLOWUP",
  "STAFF_DOCUMENTS",
  "ENTERPRISE",
  "CANDIDATE",
] as const;

export type Role = (typeof ROLES)[number];

// Role group helpers
export const STAFF_ROLES: Role[] = ["STAFF_FOLLOWUP", "STAFF_DOCUMENTS"];
export const ADMIN_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN"];

// Map a role to its dashboard path
export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case "CANDIDATE":
      return "/candidate";
    case "ENTERPRISE":
      return "/enterprise";
    case "STAFF_FOLLOWUP":
    case "STAFF_DOCUMENTS":
      return "/staff";
    case "ADMIN":
    case "SUPER_ADMIN":
      return "/admin";
    default:
      return "/onboarding";
  }
}

// Which top-level area can a role access?
export function canAccess(role: Role | undefined, area: "candidate" | "enterprise" | "staff" | "admin"): boolean {
  if (!role) return false;
  if (area === "admin") return ADMIN_ROLES.includes(role);
  if (area === "staff") return STAFF_ROLES.includes(role) || ADMIN_ROLES.includes(role);
  if (area === "enterprise") return role === "ENTERPRISE" || ADMIN_ROLES.includes(role);
  if (area === "candidate") return role === "CANDIDATE" || ADMIN_ROLES.includes(role);
  return false;
}
