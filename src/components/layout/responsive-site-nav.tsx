"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import type { SiteNavigationMessages } from "./navigation";
import { SiteNav } from "./site-nav";

export function ResponsiveSiteNav({
  messages,
  canAdmin
}: {
  messages: SiteNavigationMessages;
  canAdmin: boolean;
}) {
  const pathname = usePathname();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  useEffect(() => {
    if (disclosure.current) disclosure.current.open = false;
  }, [pathname]);

  return (
    <>
      <div className="desktop-navigation">
        <p className="nav-section-label">{messages.siteNavigation}</p>
        <SiteNav messages={messages} canAdmin={canAdmin} />
      </div>
      <details
        className="mobile-navigation"
        ref={disclosure}
        onKeyDown={(event) => {
          if (event.key === "Escape" && disclosure.current?.open) {
            disclosure.current.open = false;
            trigger.current?.focus();
          }
        }}
      >
        <summary className="mobile-navigation-trigger" ref={trigger}>
          <Menu size={18} aria-hidden="true" />
          <span>{messages.siteNavigation}</span>
        </summary>
        <SiteNav
          messages={messages}
          canAdmin={canAdmin}
          onNavigate={() => {
            if (disclosure.current) disclosure.current.open = false;
          }}
        />
      </details>
    </>
  );
}
