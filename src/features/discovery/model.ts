import type { Messages } from "@/i18n";
import { auditActionLabel } from "@/i18n/audit-actions";
import type { RecentChangeFilter } from "@/modules/activity/service";

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  pageCount: number;
};

export type ArticleSummary = {
  id: string;
  title: string;
  slug: string;
};

export type ActivityItem = {
  id: string;
  actionLabel: string;
  tone: "danger" | "warning" | "success" | "info";
  targetHref: string | null;
  targetLabel: string;
  actorLabel: string;
  timestamp: string;
  dateTime: string;
};

export function activityTone(action: string): ActivityItem["tone"] {
  if (action.includes("delete") || action.includes("failed") || action.includes("suspend")) {
    return "danger";
  }
  if (action.includes("rollback") || action.includes("reset") || action.includes("draft")) {
    return "warning";
  }
  if (action.includes("create") || action.includes("publish") || action.includes("upload")) {
    return "success";
  }
  return "info";
}

export function activityItem(
  change: {
    id: string;
    action: string;
    targetHref: string | null;
    targetLabel: string;
    actorDisplayName: string | null;
    createdAt: Date;
  },
  locale: string,
  messages: Messages
): ActivityItem {
  return {
    id: change.id,
    actionLabel: auditActionLabel(change.action, messages),
    tone: activityTone(change.action),
    targetHref: change.targetHref,
    targetLabel: change.targetLabel,
    actorLabel: change.actorDisplayName ?? messages.system,
    timestamp: change.createdAt.toLocaleString(locale),
    dateTime: change.createdAt.toISOString()
  };
}

export type FilterLink = {
  value: string;
  label: string;
  href: string;
};

export const recentChangeFilters: readonly RecentChangeFilter[] = [
  "all", "created", "edited", "published", "rollback", "media"
];

export function activityFilterLabel(
  filter: RecentChangeFilter,
  messages: Pick<Messages, "all" | "created" | "edited" | "publishedLower" | "rollbackLower" | "mediaLower">
) {
  switch (filter) {
    case "created": return messages.created;
    case "edited": return messages.edited;
    case "published": return messages.publishedLower;
    case "rollback": return messages.rollbackLower;
    case "media": return messages.mediaLower;
    default: return messages.all;
  }
}

export function extractFirstMarkdownImage(markdown: string) {
  const match = /!\[([^\]]*)\]\((\/media\/[^)\s]+)\)/.exec(markdown);
  return match?.[2] ? { alt: match[1] ?? "", src: match[2] } : null;
}
