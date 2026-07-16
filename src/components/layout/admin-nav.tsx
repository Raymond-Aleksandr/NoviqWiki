"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const links = [
    ["/admin", "Dashboard"],
    ["/admin/pages", "Pages"],
    ["/admin/users", "Users"],
    ["/admin/groups", "Groups"],
    ["/admin/roles", "Roles"],
    ["/admin/media", "Media"],
    ["/admin/settings", "Settings"],
    ["/admin/audit", "Audit"],
    ["/admin/status", "Status"]
  ] as const;
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      {links.map(([href, label]) => {
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
