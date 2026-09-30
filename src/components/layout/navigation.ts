import { BookOpen, Clock3, FileText, ImageIcon, ListChecks, ShieldCheck, Tags } from "lucide-react";
import type { Messages } from "@/i18n";

export type SiteNavigationMessages = Pick<
  Messages,
  "read" | "recentChanges" | "pages" | "categories" | "media" | "specialPages" | "admin" | "siteNavigation"
>;

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

const articleRoutes = ["/page", "/edit", "/history", "/diff"];
const specialRoutes = [
  "/special",
  "/wanted",
  "/orphaned",
  "/dead-end",
  "/short-pages",
  "/protected-pages",
  "/uncategorized",
  "/redirects",
  "/watchlist"
];

export function getSiteNavigation(
  pathname: string,
  messages: SiteNavigationMessages,
  canAdmin: boolean
) {
  return [
    {
      href: "/",
      label: messages.read,
      icon: BookOpen,
      active: pathname === "/" || articleRoutes.some((route) => matchesRoute(pathname, route))
    },
    {
      href: "/pages",
      label: messages.pages,
      icon: FileText,
      active: matchesRoute(pathname, "/pages")
    },
    {
      href: "/categories",
      label: messages.categories,
      icon: Tags,
      active: matchesRoute(pathname, "/categories")
    },
    {
      href: "/recent",
      label: messages.recentChanges,
      icon: Clock3,
      active: matchesRoute(pathname, "/recent")
    },
    {
      href: "/media",
      label: messages.media,
      icon: ImageIcon,
      active: matchesRoute(pathname, "/media")
    },
    {
      href: "/special",
      label: messages.specialPages,
      icon: ListChecks,
      active: specialRoutes.some((route) => matchesRoute(pathname, route))
    },
    ...(canAdmin
      ? [{ href: "/admin", label: messages.admin, icon: ShieldCheck, active: matchesRoute(pathname, "/admin") }]
      : [])
  ];
}
