"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Clock3, FileText, ImageIcon, ShieldCheck, Tags } from "lucide-react";

type Messages = {
  read: string;
  recentChanges: string;
  pages: string;
  categories: string;
  media: string;
  admin: string;
};

export function SiteNav({ messages, showAdmin }: { messages: Messages; showAdmin: boolean }) {
  const pathname = usePathname();
  const links = [
    {
      href: "/",
      label: messages.read,
      icon: BookOpen,
      active: pathname === "/" || pathname.startsWith("/page/")
    },
    {
      href: "/recent",
      label: messages.recentChanges,
      icon: Clock3,
      active: pathname.startsWith("/recent")
    },
    {
      href: "/pages",
      label: messages.pages,
      icon: FileText,
      active: pathname.startsWith("/pages")
    },
    {
      href: "/categories",
      label: messages.categories,
      icon: Tags,
      active: pathname.startsWith("/categories")
    },
    {
      href: "/media",
      label: messages.media,
      icon: ImageIcon,
      active: pathname.startsWith("/media")
    },
    {
      href: "/admin",
      label: messages.admin,
      icon: ShieldCheck,
      active:
        pathname.startsWith("/admin") ||
        pathname.startsWith("/edit") ||
        pathname.startsWith("/history") ||
        pathname.startsWith("/diff"),
      hidden: !showAdmin
    }
  ];

  return (
    <nav className="nav-list">
      {links
        .filter((link) => !link.hidden)
        .map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={link.active ? "active" : ""}
              aria-current={link.active ? "page" : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
    </nav>
  );
}
