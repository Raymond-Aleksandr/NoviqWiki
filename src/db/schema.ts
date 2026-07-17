import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "pending"]);
export const appearanceEnum = pgEnum("appearance", ["system", "light", "dark"]);
export const registrationModeEnum = pgEnum("registration_mode", [
  "open",
  "email_verification",
  "invite",
  "closed"
]);
export const pageStatusEnum = pgEnum("page_status", ["draft", "published", "archived", "deleted"]);
export const publicationStateEnum = pgEnum("publication_state", ["draft", "published"]);
export const mediaDriverEnum = pgEnum("media_driver", ["local", "s3"]);
export const auditActionEnum = pgEnum("audit_action", [
  "setup.complete",
  "auth.login",
  "auth.logout",
  "auth.login_failed",
  "auth.password_reset_requested",
  "auth.password_reset_completed",
  "user.created",
  "user.updated",
  "user.suspended",
  "user.activated",
  "group.updated",
  "role.updated",
  "page.created",
  "page.draft_saved",
  "page.published",
  "page.updated",
  "page.renamed",
  "page.deleted",
  "page.restored",
  "page.rollback",
  "media.uploaded",
  "media.deleted",
  "settings.updated",
  "backup.created",
  "backup.restored"
]);

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  }
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
};

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    setupComplete: boolean("setup_complete").notNull().default(false),
    ...timestamps
  },
  (table) => ({
    slugUnique: uniqueIndex("sites_slug_unique").on(table.slug)
  })
);

export const siteSettings = pgTable(
  "site_settings",
  {
    siteId: uuid("site_id")
      .primaryKey()
      .references(() => sites.id, { onDelete: "cascade" }),
    tagline: varchar("tagline", { length: 240 }).notNull().default("A modern self-hosted wiki"),
    baseUrl: text("base_url").notNull().default("http://localhost:3000"),
    logoUrl: text("logo_url"),
    faviconUrl: text("favicon_url"),
    defaultLocale: varchar("default_locale", { length: 16 }).notNull().default("en"),
    defaultAppearance: appearanceEnum("default_appearance").notNull().default("system"),
    publicMode: boolean("public_mode").notNull().default(true),
    registrationMode: registrationModeEnum("registration_mode").notNull().default("closed"),
    defaultHomepage: varchar("default_homepage", { length: 220 }).notNull().default("Home"),
    footerContent: text("footer_content").notNull().default(""),
    uploadMaxBytes: integer("upload_max_bytes").notNull().default(5_242_880),
    allowedMediaTypes: text("allowed_media_types")
      .array()
      .notNull()
      .default(
        sql`ARRAY['image/png','image/jpeg','image/gif','image/webp','application/pdf']::text[]`
      ),
    mediaDriver: mediaDriverEnum("media_driver").notNull().default("local"),
    homepageTitle: varchar("homepage_title", { length: 220 }).notNull().default("Welcome"),
    homepageIntro: text("homepage_intro").notNull().default("Start exploring this NoviqWiki site."),
    homepageFeaturedPages: text("homepage_featured_pages")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    homepageFeaturedCategories: text("homepage_featured_categories")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    homepageSections: jsonb("homepage_sections")
      .$type<{
        search: boolean;
        featured: boolean;
        recent: boolean;
        categories: boolean;
        layout?: "classic" | "portal" | "compact";
        showLogo?: boolean;
      }>()
      .notNull()
      .default({ search: true, featured: true, recent: true, categories: true }),
    seoTitle: varchar("seo_title", { length: 220 }),
    seoDescription: text("seo_description"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    siteSettingsSiteIdx: index("site_settings_site_idx").on(table.siteId)
  })
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 80 }).notNull(),
    normalizedUsername: varchar("normalized_username", { length: 80 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),
    passwordHash: text("password_hash"),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    status: userStatusEnum("status").notNull().default("active"),
    locale: varchar("locale", { length: 16 }).notNull().default("en"),
    appearance: appearanceEnum("appearance").notNull().default("system"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_normalized_username_unique").on(table.normalizedUsername),
    emailUnique: uniqueIndex("users_normalized_email_unique").on(table.normalizedEmail),
    statusIdx: index("users_status_idx").on(table.status)
  })
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 80 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 240 }).notNull(),
    ...timestamps
  },
  (table) => ({
    accountUnique: uniqueIndex("accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId
    )
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    csrfSecretHash: varchar("csrf_secret_hash", { length: 128 }).notNull(),
    userAgent: text("user_agent"),
    ipHash: varchar("ip_hash", { length: 128 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    tokenUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    userIdx: index("sessions_user_idx").on(table.userId),
    expiresIdx: index("sessions_expires_idx").on(table.expiresAt)
  })
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenUnique: uniqueIndex("email_verification_token_hash_unique").on(table.tokenHash)
  })
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenUnique: uniqueIndex("password_reset_token_hash_unique").on(table.tokenHash)
  })
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    builtIn: boolean("built_in").notNull().default(false),
    ...timestamps
  },
  (table) => ({
    groupUnique: uniqueIndex("groups_site_normalized_name_unique").on(
      table.siteId,
      table.normalizedName
    )
  })
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    builtIn: boolean("built_in").notNull().default(false),
    ...timestamps
  },
  (table) => ({
    roleUnique: uniqueIndex("roles_site_normalized_name_unique").on(
      table.siteId,
      table.normalizedName
    )
  })
);

export const permissions = pgTable("permissions", {
  key: varchar("key", { length: 120 }).primaryKey(),
  description: text("description").notNull().default("")
});

export const userGroups = pgTable(
  "user_groups",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.groupId] })
  })
);

export const groupRoles = pgTable(
  "group_roles",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.groupId, table.roleId] })
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: varchar("permission_key", { length: 120 })
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionKey] })
  })
);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    normalizedTitle: varchar("normalized_title", { length: 220 }).notNull(),
    slug: varchar("slug", { length: 240 }).notNull(),
    currentRevisionId: uuid("current_revision_id"),
    status: pageStatusEnum("status").notNull().default("draft"),
    protectionLevel: varchar("protection_level", { length: 40 }).notNull().default("none"),
    creatorId: uuid("creator_id").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedById: uuid("deleted_by_id").references(() => users.id, { onDelete: "set null" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    siteSlugUnique: uniqueIndex("pages_site_slug_unique").on(table.siteId, table.slug),
    siteTitleUnique: uniqueIndex("pages_site_normalized_title_unique").on(
      table.siteId,
      table.normalizedTitle
    ),
    statusIdx: index("pages_status_idx").on(table.siteId, table.status),
    creatorIdx: index("pages_creator_idx").on(table.creatorId)
  })
);

export const pageAliases = pgTable(
  "page_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    aliasSlug: varchar("alias_slug", { length: 240 }).notNull(),
    aliasTitle: varchar("alias_title", { length: 220 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    aliasUnique: uniqueIndex("page_aliases_site_slug_unique").on(table.siteId, table.aliasSlug),
    pageIdx: index("page_aliases_page_idx").on(table.pageId)
  })
);

export const pageRevisions = pgTable(
  "page_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    parentRevisionId: uuid("parent_revision_id"),
    revisionNumber: integer("revision_number").notNull(),
    markdown: text("markdown").notNull(),
    html: text("html").notNull(),
    plainText: text("plain_text").notNull(),
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    editorId: uuid("editor_id").references(() => users.id, { onDelete: "set null" }),
    editorDisplayName: varchar("editor_display_name", { length: 160 }).notNull(),
    editSummary: text("edit_summary").notNull().default(""),
    state: publicationStateEnum("state").notNull(),
    headings: jsonb("headings")
      .$type<Array<{ depth: number; id: string; text: string }>>()
      .notNull()
      .default([]),
    categories: text("categories")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    outboundLinks: text("outbound_links")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    revUnique: uniqueIndex("page_revisions_page_number_unique").on(
      table.pageId,
      table.revisionNumber
    ),
    pageIdx: index("page_revisions_page_idx").on(table.pageId),
    editorIdx: index("page_revisions_editor_idx").on(table.editorId),
    hashIdx: index("page_revisions_hash_idx").on(table.contentHash)
  })
);

export const pageDrafts = pgTable(
  "page_drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    baseRevisionId: uuid("base_revision_id"),
    markdown: text("markdown").notNull(),
    editorId: uuid("editor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    editSummary: text("edit_summary").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    editorPageUnique: uniqueIndex("page_drafts_page_editor_unique").on(table.pageId, table.editorId)
  })
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull(),
    description: text("description").notNull().default(""),
    ...timestamps
  },
  (table) => ({
    categoryUnique: uniqueIndex("categories_site_slug_unique").on(table.siteId, table.slug)
  })
);

export const pageCategories = pgTable(
  "page_categories",
  {
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pageId, table.categoryId] }),
    categoryIdx: index("page_categories_category_idx").on(table.categoryId)
  })
);

export const pageLinks = pgTable(
  "page_links",
  {
    sourcePageId: uuid("source_page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    targetTitle: varchar("target_title", { length: 220 }).notNull(),
    targetNormalizedTitle: varchar("target_normalized_title", { length: 220 }).notNull(),
    targetPageId: uuid("target_page_id").references(() => pages.id, { onDelete: "set null" }),
    label: varchar("label", { length: 220 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.sourcePageId, table.targetNormalizedTitle] }),
    targetIdx: index("page_links_target_idx").on(table.targetPageId)
  })
);

export const pageWatchlist = pgTable(
  "page_watchlist",
  {
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.pageId] }),
    siteUserIdx: index("page_watchlist_site_user_idx").on(table.siteId, table.userId),
    pageIdx: index("page_watchlist_page_idx").on(table.pageId)
  })
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    uploaderId: uuid("uploader_id").references(() => users.id, { onDelete: "set null" }),
    originalFilename: varchar("original_filename", { length: 260 }).notNull(),
    safeFilename: varchar("safe_filename", { length: 260 }).notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    contentHash: varchar("content_hash", { length: 128 }).notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text").notNull().default(""),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    hashIdx: index("media_assets_hash_idx").on(table.siteId, table.contentHash),
    filenameIdx: index("media_assets_filename_idx").on(table.siteId, table.safeFilename),
    storageUnique: uniqueIndex("media_assets_storage_key_unique").on(table.storageKey)
  })
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorDisplayName: varchar("actor_display_name", { length: 160 }),
    action: auditActionEnum("action").notNull(),
    targetType: varchar("target_type", { length: 80 }).notNull(),
    targetId: varchar("target_id", { length: 160 }),
    requestId: varchar("request_id", { length: 120 }),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgent: text("user_agent"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    siteTimeIdx: index("audit_logs_site_time_idx").on(table.siteId, table.createdAt),
    actorIdx: index("audit_logs_actor_idx").on(table.actorId),
    actionIdx: index("audit_logs_action_idx").on(table.action)
  })
);

export const searchIndex = pgTable(
  "search_index",
  {
    pageId: uuid("page_id")
      .primaryKey()
      .references(() => pages.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    aliases: text("aliases").notNull().default(""),
    plainText: text("plain_text").notNull(),
    categories: text("categories").notNull().default(""),
    searchVector: tsvector("search_vector")
      .notNull()
      .generatedAlwaysAs(
        sql`setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(aliases, '')), 'B') || setweight(to_tsvector('simple', coalesce(categories, '')), 'B') || setweight(to_tsvector('simple', coalesce(plain_text, '')), 'C')`
      ),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    siteIdx: index("search_index_site_idx").on(table.siteId),
    vectorIdx: index("search_index_vector_idx").using("gin", table.searchVector)
  })
);

export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: varchar("scope", { length: 80 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    keyIdx: index("rate_limit_events_key_idx").on(table.scope, table.keyHash, table.createdAt)
  })
);

export const siteRelations = relations(sites, ({ one, many }) => ({
  settings: one(siteSettings, { fields: [sites.id], references: [siteSettings.siteId] }),
  pages: many(pages),
  groups: many(groups),
  roles: many(roles)
}));

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  groups: many(userGroups),
  revisions: many(pageRevisions),
  media: many(mediaAssets),
  watchedPages: many(pageWatchlist)
}));

export const pageRelations = relations(pages, ({ one, many }) => ({
  site: one(sites, { fields: [pages.siteId], references: [sites.id] }),
  creator: one(users, { fields: [pages.creatorId], references: [users.id] }),
  revisions: many(pageRevisions),
  drafts: many(pageDrafts),
  aliases: many(pageAliases),
  categories: many(pageCategories),
  watchers: many(pageWatchlist)
}));

export const revisionRelations = relations(pageRevisions, ({ one }) => ({
  page: one(pages, { fields: [pageRevisions.pageId], references: [pages.id] }),
  editor: one(users, { fields: [pageRevisions.editorId], references: [users.id] })
}));

export const pageWatchlistRelations = relations(pageWatchlist, ({ one }) => ({
  site: one(sites, { fields: [pageWatchlist.siteId], references: [sites.id] }),
  user: one(users, { fields: [pageWatchlist.userId], references: [users.id] }),
  page: one(pages, { fields: [pageWatchlist.pageId], references: [pages.id] })
}));

export type Site = typeof sites.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageRevision = typeof pageRevisions.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type PageWatch = typeof pageWatchlist.$inferSelect;
