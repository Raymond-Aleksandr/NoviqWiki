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
import type { Messages } from "@/i18n";

export function AdminNav({ messages }: { messages: Messages }) {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: messages.dashboard, icon: LayoutDashboard },
    { href: "/admin/pages", label: messages.pages, icon: FileText },
    { href: "/admin/users", label: messages.users, icon: UserRoundCog },
    { href: "/admin/groups", label: messages.groups, icon: Users },
    { href: "/admin/roles", label: messages.roles, icon: ShieldCheck },
    { href: "/admin/media", label: messages.media, icon: ImageIcon },
    { href: "/admin/settings", label: messages.settings, icon: Settings },
    { href: "/admin/audit", label: messages.audit, icon: ScrollText },
    { href: "/admin/status", label: messages.status, icon: ServerCog }
  ] as const;
  return (
    <nav className="admin-tabs" aria-label={messages.adminNavigation}>
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
