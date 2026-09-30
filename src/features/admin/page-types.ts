import type { Messages } from "@/i18n";

export type AdminPageStatus = "draft" | "published" | "archived" | "deleted";

export type AdminPageRow = {
  id: string;
  slug: string;
  title: string;
  status: AdminPageStatus;
  protected: boolean;
  updated: { dateTime: string; label: string };
};

export type PageMessages = Pick<Messages,
  | "pages" | "filterPages" | "search" | "clearFilters" | "status" | "statusAll"
  | "statusPublished" | "statusDraft" | "statusArchived" | "statusDeleted" | "createPage"
  | "title" | "slug" | "updatedColumn" | "actions" | "noResults" | "pageProtected"
  | "edit" | "revisions" | "rename" | "renamePage" | "renamePageConfirmBody"
  | "newTitle" | "newSlug" | "keepPreviousSlugAsRedirect" | "protect" | "unprotect"
  | "protectPage" | "unprotectPage" | "protectPageConfirmBody" | "unprotectPageConfirmBody"
  | "protectPageConfirmWarning" | "archive" | "archivePage" | "archivePageConfirmBody"
  | "unarchive" | "restore" | "delete" | "deletePageConfirmBody" | "destructiveActionWarning"
  | "cancel" | "working"
>;
