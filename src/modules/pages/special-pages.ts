import type { Messages } from "@/i18n";

export type SpecialPageIcon =
  | "activity"
  | "admin"
  | "audit"
  | "categories"
  | "deadEnd"
  | "groups"
  | "media"
  | "orphaned"
  | "pages"
  | "protected"
  | "random"
  | "redirects"
  | "roles"
  | "search"
  | "settings"
  | "short"
  | "status"
  | "uncategorized"
  | "users"
  | "wanted"
  | "watchlist";

export type SpecialPageLink = {
  href: string;
  title: string;
  description: string;
  icon: SpecialPageIcon;
};

export type SpecialPageSection = {
  id: "browse" | "maintenance" | "administration";
  title: string;
  description: string;
  links: SpecialPageLink[];
};

export function getSpecialPageSections(
  messages: Messages,
  { includeAdmin = false }: { includeAdmin?: boolean } = {}
): SpecialPageSection[] {
  const sections: SpecialPageSection[] = [
    {
      id: "browse",
      title: messages.specialPageGroupBrowsing,
      description: messages.specialPageGroupBrowsingDescription,
      links: [
        {
          href: "/search",
          title: messages.search,
          description: messages.specialSearchDescription,
          icon: "search"
        },
        {
          href: "/random",
          title: messages.randomPage,
          description: messages.randomPageDescription,
          icon: "random"
        },
        {
          href: "/watchlist",
          title: messages.watchlist,
          description: messages.watchlistDescription,
          icon: "watchlist"
        },
        {
          href: "/pages",
          title: messages.allPages,
          description: messages.allPagesDescription,
          icon: "pages"
        },
        {
          href: "/recent",
          title: messages.recentChanges,
          description: messages.recentChangesDescription,
          icon: "activity"
        },
        {
          href: "/categories",
          title: messages.categories,
          description: messages.categoriesDescription,
          icon: "categories"
        },
        {
          href: "/media",
          title: messages.mediaLibrary,
          description: messages.mediaLibraryDescription,
          icon: "media"
        }
      ]
    },
    {
      id: "maintenance",
      title: messages.specialPageGroupMaintenance,
      description: messages.specialPageGroupMaintenanceDescription,
      links: [
        {
          href: "/wanted",
          title: messages.wantedPages,
          description: messages.wantedPagesDescription,
          icon: "wanted"
        },
        {
          href: "/orphaned",
          title: messages.orphanedPages,
          description: messages.orphanedPagesDescription,
          icon: "orphaned"
        },
        {
          href: "/dead-end",
          title: messages.deadEndPages,
          description: messages.deadEndPagesDescription,
          icon: "deadEnd"
        },
        {
          href: "/short-pages",
          title: messages.shortPages,
          description: messages.shortPagesDescription,
          icon: "short"
        },
        {
          href: "/protected-pages",
          title: messages.protectedPages,
          description: messages.protectedPagesDescription,
          icon: "protected"
        },
        {
          href: "/uncategorized",
          title: messages.uncategorizedPages,
          description: messages.uncategorizedPagesDescription,
          icon: "uncategorized"
        },
        {
          href: "/redirects",
          title: messages.redirectPages,
          description: messages.redirectPagesDescription,
          icon: "redirects"
        }
      ]
    }
  ];

  if (includeAdmin) {
    sections.push({
      id: "administration",
      title: messages.specialPageGroupAdministration,
      description: messages.specialPageGroupAdministrationDescription,
      links: [
        {
          href: "/admin",
          title: messages.dashboard,
          description: messages.specialAdminDashboardDescription,
          icon: "admin"
        },
        {
          href: "/admin/pages",
          title: messages.pages,
          description: messages.specialAdminPagesDescription,
          icon: "pages"
        },
        {
          href: "/admin/users",
          title: messages.users,
          description: messages.specialAdminUsersDescription,
          icon: "users"
        },
        {
          href: "/admin/groups",
          title: messages.groups,
          description: messages.specialAdminGroupsDescription,
          icon: "groups"
        },
        {
          href: "/admin/roles",
          title: messages.roles,
          description: messages.specialAdminRolesDescription,
          icon: "roles"
        },
        {
          href: "/admin/settings",
          title: messages.siteSettings,
          description: messages.specialAdminSettingsDescription,
          icon: "settings"
        },
        {
          href: "/admin/audit",
          title: messages.audit,
          description: messages.specialAdminAuditDescription,
          icon: "audit"
        },
        {
          href: "/admin/status",
          title: messages.operationalStatus,
          description: messages.specialAdminStatusDescription,
          icon: "status"
        }
      ]
    });
  }

  return sections;
}
