import { Sidebar, type NavItem } from "@/components/layout/sidebar";
import { getLocale } from "@/lib/i18n";

const items: NavItem[] = [
  { label: "Dashboard", href: "/enterprise", icon: "layoutDashboard" },
  { label: "Job offers", href: "/enterprise/offers", icon: "briefcase" },
  { label: "Candidates", href: "/enterprise/candidates", icon: "users" },
  { label: "Interviews", href: "/enterprise/interviews", icon: "clipboardList" },
  { label: "Documents", href: "/enterprise/documents", icon: "fileText" },
  { label: "Invoices", href: "/enterprise/invoices", icon: "receipt" },
];

export default async function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLocale();
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Enterprise" items={items} currentLang={lang} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
