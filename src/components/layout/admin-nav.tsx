"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Messages } from "@/i18n";

export function AdminNav({ messages }: { messages: Messages }) {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: messages.dashboard },
    { href: "/admin/pages", label: messages.pages },
    { href: "/admin/users", label: messages.users },
    { href: "/admin/groups", label: messages.groups },
    { href: "/admin/roles", label: messages.roles },
    { href: "/admin/media", label: messages.media },
    { href: "/admin/settings", label: messages.settings },
    { href: "/admin/audit", label: messages.audit },
    { href: "/admin/status", label: messages.status }
  ] as const;
  return (
    <nav className="admin-tabs" aria-label={messages.adminNavigation}>
      {links.map(({ href, label }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            className={`button ${active ? "active" : ""}`}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
