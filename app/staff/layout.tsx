import { Sidebar, type NavItem } from "@/components/layout/sidebar";

const items: NavItem[] = [
  { label: "Dashboard", href: "/staff", icon: "layoutDashboard" },
  { label: "Document queue", href: "/staff/documents", icon: "fileCheck" },
  { label: "Follow-ups", href: "/staff/followups", icon: "clipboardList" },
  { label: "Alerts", href: "/staff/alerts", icon: "alertTriangle" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Staff" items={items} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
