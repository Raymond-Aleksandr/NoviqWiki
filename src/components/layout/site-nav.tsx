"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSiteNavigation, type SiteNavigationMessages } from "./navigation";

export function SiteNav({
  messages,
  canAdmin,
  onNavigate
}: {
  messages: SiteNavigationMessages;
  canAdmin: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="nav-list" aria-label={messages.siteNavigation}>
      {getSiteNavigation(pathname, messages, canAdmin).map(({ href, label, icon: Icon, active }) => (
        <Link
          key={href}
          href={href}
          className={active ? "active" : undefined}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
