import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { getLocale } from "@/lib/i18n";

const items: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "layoutDashboard" },
  { label: "Users", href: "/admin/users", icon: "users" },
  { label: "Disputes", href: "/admin/disputes", icon: "alertTriangle" },
  { label: "Invoices", href: "/admin/invoices", icon: "receipt" },
  { label: "Audit log", href: "/admin/audit", icon: "activity" },
  { label: "Feature flags", href: "/admin/feature-flags", icon: "shieldCheck" },
  { label: "Translations", href: "/admin/i18n", icon: "fileText" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLocale();
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Admin" items={items} currentLang={lang} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
