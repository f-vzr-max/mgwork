// MG Work — Candidate area layout.
//
// Mobile-first (designed in a 402x874 frame): sticky `CandAppBar` on top, a
// scrollable main column with bottom padding for the fixed `CandTabBar`. At
// `lg:` and above we switch to a 2-column shell: vertical `WebSidebar` on the
// left (240px) and a centered main column capped at 1440px.
//
// `{children}` is rendered EXACTLY ONCE in a single shared `<main>`. Only the
// surrounding chrome is toggled by Tailwind responsive utilities — the mobile
// chrome lives in a `lg:hidden` wrapper, the desktop sidebar in a
// `hidden lg:flex` wrapper. This keeps the layout a server component (Clerk +
// Prisma) while delegating the interactive bits (drawer, `CandTabBar`,
// `WebSidebar`) to their client implementations.
//
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { type SidebarItem } from "@/components/mg";
import { CandChatProvider } from "@/components/mg/cand-chat-context";
import { CandWebSidebar } from "@/components/mg/cand-web-sidebar";
import { CandMobileChrome } from "@/components/mg/cand-mobile-chrome";
import { ChatPushShell } from "./chat/chat-drawer";
import { ChatSearchParamsBridge } from "./_components/chat-search-params-bridge";

// Locale-aware tab title. Without this the root layout's static (French)
// metadata wins on every authed route, so the document title stays French
// after switching the site language.
export async function generateMetadata() {
  const t = await getTranslations("authMeta");
  return { title: t("candidate.title") };
}

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  const t = await getTranslations("app.candidate");

  const NAV_ITEMS: SidebarItem[] = [
    { id: "home", label: t("nav.home"), icon: "home", href: "/candidate" },
    { id: "profile", label: t("nav.profile"), icon: "book-user", href: "/candidate/profile" },
    { id: "docs", label: t("nav.documents"), icon: "file-text", href: "/candidate/documents" },
    { id: "jobs", label: t("nav.jobs"), icon: "briefcase", href: "/candidate/matches" },
    { id: "apps", label: t("nav.applications"), icon: "circle-dot", href: "/candidate/applications" },
  ];

  // Drawer nav for the mobile chrome (labels resolved here, server-side).
  const MOBILE_NAV = NAV_ITEMS.filter(
    (it): it is Extract<SidebarItem, { id: string }> => "id" in it && Boolean(it.id),
  ).map((it) => ({ id: it.id, label: it.label, href: it.href }));

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
    <CandChatProvider>
      <div
        className="flex flex-col lg:flex-row"
        style={{ minHeight: "100vh", background: "hsl(var(--background))" }}
      >
        {/* Desktop chrome: sidebar (hidden below lg). ---------------------- */}
        <div className="hidden lg:flex">
          <CandWebSidebar
            role={t("role")}
            items={NAV_ITEMS}
            user={{ name: fullName, email: user.email }}
            homeHref="/candidate"
          />
        </div>

        {/* Mobile chrome: app-bar + drawer + tab-bar (hidden at lg+). ------ */}
        <div className="lg:hidden">
          <CandMobileChrome navItems={MOBILE_NAV} userName={fullName} />
        </div>

        {/* Push-shell: at lg+ it reflows into [content][chat 360] when the chat
            drawer opens in push mode; below lg the drawer overlays. `children`
            is still rendered exactly once, inside the single shared <main>. */}
        <ChatPushShell>
          <main className="flex justify-center pb-20 lg:pb-0">
            <div style={{ width: "100%", maxWidth: 1440, padding: "32px 24px" }}>{children}</div>
          </main>
        </ChatPushShell>

        <Suspense fallback={null}>
          <ChatSearchParamsBridge />
        </Suspense>
      </div>
    </CandChatProvider>
  );
}
