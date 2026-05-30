// MG Work — Candidate area layout.
//
// Mobile-first (designed in a 402x874 frame): sticky `CandAppBar` on top, a
// scrollable main column with bottom padding for the fixed `CandTabBar`. At
// `lg:` and above we switch to a 2-column shell: vertical `WebSidebar` on the
// left (240px) and a centered main column capped at 720px.
//
// We render BOTH structures in the same tree and toggle them with Tailwind
// responsive utilities — this keeps the layout a server component (Clerk +
// Prisma) while delegating the pathname-aware bits (`CandTabBar`,
// `WebSidebar`) to their existing client implementations.
//
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  CandAppBar,
  CandTabBar,
  type SidebarItem,
} from "@/components/mg";
import { CandWebSidebar } from "@/components/mg/cand-web-sidebar";

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.candidate");

  const NAV_ITEMS: SidebarItem[] = [
    { id: "home", label: t("nav.home"), icon: "home", href: "/candidate" },
    { id: "docs", label: t("nav.documents"), icon: "file-text", href: "/candidate/documents" },
    { id: "jobs", label: t("nav.jobs"), icon: "briefcase", href: "/candidate/matches" },
    { id: "apps", label: t("nav.applications"), icon: "circle-dot", href: "/candidate/applications" },
    { id: "chat", label: t("nav.chat"), icon: "message-circle", href: "/candidate/chat" },
  ];

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      email: true,
      role: true,
      candidate: { select: { firstName: true, lastName: true } },
    },
  });
  if (!user) redirect("/onboarding");

  const fullName = user.candidate
    ? `${user.candidate.firstName} ${user.candidate.lastName}`.trim()
    : user.email;

  return (
    <>
      {/* Mobile + tablet shell ------------------------------------------- */}
      <div
        className="lg:hidden"
        style={{
          minHeight: "100vh",
          background: "hsl(var(--background))",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <CandAppBar userName={fullName} />
        <main style={{ flex: 1, paddingBottom: 80 }}>{children}</main>
        <CandTabBar />
      </div>

      {/* Desktop shell --------------------------------------------------- */}
      <div className="hidden lg:flex" style={{ minHeight: "100vh", background: "hsl(var(--background))" }}>
        <CandWebSidebar
          role={t("role")}
          items={NAV_ITEMS}
          user={{ name: fullName, email: user.email }}
          homeHref="/candidate"
        />
        <main style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 720, padding: "32px 24px" }}>{children}</div>
        </main>
      </div>
    </>
  );
}
