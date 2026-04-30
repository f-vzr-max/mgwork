import { Sidebar, type NavItem } from "@/components/layout/sidebar";

const items: NavItem[] = [
  { label: "Dashboard", href: "/enterprise", icon: "layoutDashboard" },
  { label: "Job offers", href: "/enterprise/offers", icon: "briefcase" },
  { label: "Candidates", href: "/enterprise/candidates", icon: "users" },
  { label: "Documents", href: "/enterprise/documents", icon: "fileText" },
  { label: "Invoices", href: "/enterprise/invoices", icon: "receipt" },
];

export default function EnterpriseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Enterprise" items={items} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
