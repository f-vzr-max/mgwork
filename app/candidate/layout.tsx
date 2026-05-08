import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { getLocale } from "@/lib/i18n";

const items: NavItem[] = [
  { label: "Dashboard", href: "/candidate", icon: "layoutDashboard" },
  { label: "My profile", href: "/candidate/profile", icon: "user" },
  { label: "Documents", href: "/candidate/documents", icon: "fileText" },
  { label: "Job offers", href: "/candidate/jobs", icon: "briefcase" },
  { label: "Applications", href: "/candidate/applications", icon: "clipboardList" },
  { label: "Chat", href: "/candidate/chat", icon: "messageCircle" },
];

export default async function CandidateLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLocale();
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Candidate" items={items} currentLang={lang} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
