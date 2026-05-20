// MG Work — Enterprise area layout.
//
// Server component that resolves the signed-in user via Clerk and hands off
// rendering to <EnterpriseShell />, a client component that reads the current
// pathname to highlight the active sidebar item.

import { currentUser } from "@clerk/nextjs/server";
import { EnterpriseShell } from "@/components/layout/enterprise-shell";

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const name = u
    ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Compte"
    : "Compte";
  const email = u?.emailAddresses?.[0]?.emailAddress ?? "";
  const user = { name, email };

  return <EnterpriseShell user={user}>{children}</EnterpriseShell>;
}
