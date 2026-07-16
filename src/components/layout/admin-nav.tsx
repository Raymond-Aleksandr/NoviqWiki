"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export function AdminNav() {
  const pathname = usePathname();
  const links = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/pages", label: "Pages" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/groups", label: "Groups" },
    { href: "/admin/roles", label: "Roles" },
    { href: "/admin/media", label: "Media" },
    { href: "/admin/settings", label: "Settings" },
    { href: "/admin/audit", label: "Audit" },
    { href: "/admin/status", label: "Status" }
  ] as const;
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      {links.map(({ href, label }) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            className={`button ${active ? "active" : ""}`}
            href={href}
            aria-current={active ? "page" : undefined}
          >
            {active && href === "/admin" ? <LayoutDashboard size={15} aria-hidden="true" /> : null}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
