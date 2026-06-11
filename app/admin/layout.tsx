// MG Work — Admin area layout.
//
// Server component that resolves the signed-in user via Clerk and hands off to
// <AdminShell />, a client component that uses the current pathname to drive
// the WebSidebar active state.

import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { AdminShell } from "@/components/layout/admin-shell";

// Locale-aware tab title. Without this the root layout's static (French)
// metadata wins on every authed route, so the document title stays French
// after switching the site language.
export async function generateMetadata() {
  const t = await getTranslations("authMeta");
  return { title: t("admin.title") };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const name = u
    ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Compte"
    : "Compte";
  const email = u?.emailAddresses?.[0]?.emailAddress ?? "";
  const user = { name, email };

  return <AdminShell user={user}>{children}</AdminShell>;
}
