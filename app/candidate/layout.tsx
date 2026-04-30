import { Sidebar, type NavItem } from "@/components/layout/sidebar";

const items: NavItem[] = [
  { label: "Dashboard", href: "/candidate", icon: "layoutDashboard" },
  { label: "My profile", href: "/candidate/profile", icon: "user" },
  { label: "Documents", href: "/candidate/documents", icon: "fileText" },
  { label: "Job offers", href: "/candidate/jobs", icon: "briefcase" },
  { label: "Messages", href: "/candidate/messages", icon: "messageCircle" },
];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar brandLabel="Candidate" items={items} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
