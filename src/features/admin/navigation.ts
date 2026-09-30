import type { Messages } from "@/i18n";

export type AdminNavigationItem = {
  href: string;
  label: string;
  icon: "dashboard" | "pages" | "users" | "groups" | "roles" | "media" | "settings" | "audit" | "status";
};

export function getAdminNavigation(messages: Pick<Messages,
  "dashboard" | "pages" | "users" | "groups" | "roles" | "media" | "settings" | "audit" | "status"
>): AdminNavigationItem[] {
  return [
    { href: "/admin", label: messages.dashboard, icon: "dashboard" },
    { href: "/admin/pages", label: messages.pages, icon: "pages" },
    { href: "/admin/users", label: messages.users, icon: "users" },
    { href: "/admin/groups", label: messages.groups, icon: "groups" },
    { href: "/admin/roles", label: messages.roles, icon: "roles" },
    { href: "/admin/media", label: messages.media, icon: "media" },
    { href: "/admin/settings", label: messages.settings, icon: "settings" },
    { href: "/admin/audit", label: messages.audit, icon: "audit" },
    { href: "/admin/status", label: messages.status, icon: "status" }
  ];
}
