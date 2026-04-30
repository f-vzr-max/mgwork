import { Sidebar, type NavItem } from "@/components/layout/sidebar";

const items: NavItem[] = [
  { label: "Overview", href: "/admin", icon: "layoutDashboard" },
  { label: "Candidates", href: "/admin/candidates", icon: "users" },
  { label: "Enterprises", href: "/admin/enterprises", icon: "building2" },
  { label: "Compliance", href: "/admin/compliance", icon: "shieldCheck" },
  { label: "Invoices", href: "/admin/invoices", icon: "receipt" },
  { label: "Audit log", href: "/admin/audit", icon: "activity" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Admin" items={items} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
