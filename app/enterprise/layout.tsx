// MG Work — Enterprise area layout.
//
// Server component that resolves the signed-in user via Clerk and hands off
// rendering to <EnterpriseShell />, a client component that reads the current
// pathname to highlight the active sidebar item.

import { currentUser } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { EnterpriseShell } from "@/components/layout/enterprise-shell";

// Locale-aware tab title. Without this the root layout's static (French)
// metadata wins on every authed route, so the document title stays French
// after switching the site language.
export async function generateMetadata() {
  const t = await getTranslations("authMeta");
  return { title: t("enterprise.title") };
}

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const name = u
    ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Compte"
    : "Compte";
  const email = u?.emailAddresses?.[0]?.emailAddress ?? "";
  const user = { name, email };

  return <EnterpriseShell user={user}>{children}</EnterpriseShell>;
}
