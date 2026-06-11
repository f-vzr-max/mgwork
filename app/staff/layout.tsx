// MG Work — Staff area layout.
//
// Server component that resolves the signed-in user via Clerk and hands off to
// <StaffShell />, a client component that uses the current pathname to drive
// the WebSidebar active state.

import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { StaffShell } from "@/components/layout/staff-shell";

// Locale-aware tab title. Without this the root layout's static (French)
// metadata wins on every authed route, so the document title stays French
// after switching the site language.
export async function generateMetadata() {
  const t = await getTranslations("authMeta");
  return { title: t("staff.title") };
}

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const name = u
    ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Compte"
    : "Compte";
  const email = u?.emailAddresses?.[0]?.emailAddress ?? "";
  const user = { name, email };

  return <StaffShell user={user}>{children}</StaffShell>;
}
