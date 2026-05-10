import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { getLocale } from "@/lib/i18n";

const items: NavItem[] = [
  { label: "Dashboard", href: "/staff", icon: "layoutDashboard" },
  { label: "Document queue", href: "/staff/documents", icon: "fileCheck" },
  { label: "Follow-ups", href: "/staff/followup", icon: "clipboardList" },
  { label: "Alerts", href: "/staff/alerts", icon: "alertTriangle" },
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLocale();
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Staff" items={items} currentLang={lang} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
