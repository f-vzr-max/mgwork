"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Building2,
  ClipboardList,
  FileCheck,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Receipt,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  alertTriangle: AlertTriangle,
  briefcase: Briefcase,
  building2: Building2,
  clipboardList: ClipboardList,
  fileCheck: FileCheck,
  fileText: FileText,
  layoutDashboard: LayoutDashboard,
  messageCircle: MessageCircle,
  receipt: Receipt,
  shieldCheck: ShieldCheck,
  user: User,
  users: Users,
};

export type IconName = keyof typeof ICONS;

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

export function Sidebar({
  brandLabel,
  items,
}: {
  brandLabel: string;
  items: NavItem[];
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
          MG Work
        </Link>
      </div>
      <div className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {brandLabel}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4">
        <UserButton afterSignOutUrl="/" />
      </div>
    </aside>
  );
}
