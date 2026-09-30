"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  ImageIcon,
  LayoutDashboard,
  ScrollText,
  ServerCog,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users
} from "lucide-react";
import type { AdminNavigationItem } from "@/features/admin/navigation";

const icons = {
  dashboard: LayoutDashboard,
  pages: FileText,
  users: UserRoundCog,
  groups: Users,
  roles: ShieldCheck,
  media: ImageIcon,
  settings: Settings,
  audit: ScrollText,
  status: ServerCog
};

export function AdminNav({ items, label }: { items: AdminNavigationItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav className="admin-tabs" aria-label={label}>
      {items.map(({ href, label, icon }) => {
        const Icon = icons[icon];
        const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            className={`button ${active ? "active" : ""}`}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={15} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
