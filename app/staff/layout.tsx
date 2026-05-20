// MG Work — Staff area layout.
//
// Server component that resolves the signed-in user via Clerk and hands off to
// <StaffShell />, a client component that uses the current pathname to drive
// the WebSidebar active state.

import { currentUser } from "@clerk/nextjs/server";
import { StaffShell } from "@/components/layout/staff-shell";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const name = u
    ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Compte"
    : "Compte";
  const email = u?.emailAddresses?.[0]?.emailAddress ?? "";
  const user = { name, email };

  return <StaffShell user={user}>{children}</StaffShell>;
}
