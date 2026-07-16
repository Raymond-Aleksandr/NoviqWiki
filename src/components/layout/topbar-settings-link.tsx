"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

export function TopbarSettingsLink({ label }: { label: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) {
    return null;
  }
  return (
    <Link className="button" href="/admin/settings" aria-label={label}>
      <Settings size={18} aria-hidden="true" />
    </Link>
  );
}
