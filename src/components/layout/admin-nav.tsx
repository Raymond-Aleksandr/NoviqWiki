"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  FileText,
  ImageIcon,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound
} from "lucide-react";

export function AdminNav() {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/pages", label: "Pages", icon: FileText },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/groups", label: "Groups", icon: UsersRound },
    { href: "/admin/roles", label: "Roles", icon: ShieldCheck },
    { href: "/admin/media", label: "Media", icon: ImageIcon },
    { href: "/admin/settings", label: "Settings", icon: Settings },
    { href: "/admin/audit", label: "Audit", icon: ScrollText },
    { href: "/admin/status", label: "Status", icon: Database }
  ] as const;
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
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
