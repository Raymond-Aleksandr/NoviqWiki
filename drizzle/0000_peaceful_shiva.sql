CREATE TYPE "public"."appearance" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('setup.complete', 'auth.login', 'auth.logout', 'auth.login_failed', 'auth.password_reset_requested', 'auth.password_reset_completed', 'user.created', 'user.updated', 'user.suspended', 'user.activated', 'group.updated', 'role.updated', 'page.created', 'page.draft_saved', 'page.published', 'page.updated', 'page.renamed', 'page.deleted', 'page.restored', 'page.rollback', 'media.uploaded', 'media.deleted', 'settings.updated', 'backup.created', 'backup.restored');--> statement-breakpoint
CREATE TYPE "public"."media_driver" AS ENUM('local', 's3');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('draft', 'published', 'archived', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."publication_state" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."registration_mode" AS ENUM('open', 'email_verification', 'invite', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'pending');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(80) NOT NULL,
	"provider_account_id" varchar(240) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"actor_id" uuid,
	"actor_display_name" varchar(160),
	"action" "audit_action" NOT NULL,
	"target_type" varchar(80) NOT NULL,
	"target_id" varchar(160),
	"request_id" varchar(120),
	"ip_hash" varchar(128),
	"user_agent" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(180) NOT NULL,
	"normalized_name" varchar(180) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_roles" (
	"group_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_roles_group_id_role_id_pk" PRIMARY KEY("group_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"uploader_id" uuid,
	"original_filename" varchar(260) NOT NULL,
	"safe_filename" varchar(260) NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"byte_size" bigint NOT NULL,
	"content_hash" varchar(128) NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"alias_slug" varchar(240) NOT NULL,
	"alias_title" varchar(220) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_categories" (
	"page_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_categories_page_id_category_id_pk" PRIMARY KEY("page_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "page_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"base_revision_id" uuid,
	"markdown" text NOT NULL,
	"editor_id" uuid NOT NULL,
	"edit_summary" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_links" (
	"source_page_id" uuid NOT NULL,
	"target_title" varchar(220) NOT NULL,
	"target_normalized_title" varchar(220) NOT NULL,
	"target_page_id" uuid,
	"label" varchar(220),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_links_source_page_id_target_normalized_title_pk" PRIMARY KEY("source_page_id","target_normalized_title")
);
--> statement-breakpoint
CREATE TABLE "page_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"parent_revision_id" uuid,
	"revision_number" integer NOT NULL,
	"markdown" text NOT NULL,
	"html" text NOT NULL,
	"plain_text" text NOT NULL,
	"content_hash" varchar(128) NOT NULL,
	"editor_id" uuid,
	"editor_display_name" varchar(160) NOT NULL,
	"edit_summary" text DEFAULT '' NOT NULL,
	"state" "publication_state" NOT NULL,
	"headings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"outbound_links" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"title" varchar(220) NOT NULL,
	"normalized_title" varchar(220) NOT NULL,
	"slug" varchar(240) NOT NULL,
	"current_revision_id" uuid,
	"status" "page_status" DEFAULT 'draft' NOT NULL,
	"protection_level" varchar(40) DEFAULT 'none' NOT NULL,
	"creator_id" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" varchar(120) PRIMARY KEY NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(80) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"normalized_name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"built_in" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_index" (
	"page_id" uuid PRIMARY KEY NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text NOT NULL,
	"aliases" text DEFAULT '' NOT NULL,
	"plain_text" text NOT NULL,
	"categories" text DEFAULT '' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce(title, '')), 'A') || setweight(to_tsvector('simple', coalesce(aliases, '')), 'B') || setweight(to_tsvector('simple', coalesce(categories, '')), 'B') || setweight(to_tsvector('simple', coalesce(plain_text, '')), 'C')) STORED NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"csrf_secret_hash" varchar(128) NOT NULL,
	"user_agent" text,
	"ip_hash" varchar(128),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"site_id" uuid PRIMARY KEY NOT NULL,
	"tagline" varchar(240) DEFAULT 'A modern self-hosted wiki' NOT NULL,
	"base_url" text DEFAULT 'http://localhost:3000' NOT NULL,
	"logo_url" text,
	"favicon_url" text,
	"default_locale" varchar(16) DEFAULT 'en' NOT NULL,
	"default_appearance" "appearance" DEFAULT 'system' NOT NULL,
	"public_mode" boolean DEFAULT true NOT NULL,
	"registration_mode" "registration_mode" DEFAULT 'closed' NOT NULL,
	"default_homepage" varchar(220) DEFAULT 'Home' NOT NULL,
	"footer_content" text DEFAULT '' NOT NULL,
	"upload_max_bytes" integer DEFAULT 5242880 NOT NULL,
	"allowed_media_types" text[] DEFAULT ARRAY['image/png','image/jpeg','image/gif','image/webp','application/pdf']::text[] NOT NULL,
	"media_driver" "media_driver" DEFAULT 'local' NOT NULL,
	"homepage_title" varchar(220) DEFAULT 'Welcome' NOT NULL,
	"homepage_intro" text DEFAULT 'Start exploring this NoviqWiki site.' NOT NULL,
	"homepage_featured_pages" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"homepage_featured_categories" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"homepage_sections" jsonb DEFAULT '{"search":true,"featured":true,"recent":true,"categories":true}'::jsonb NOT NULL,
	"seo_title" varchar(220),
	"seo_description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"setup_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_groups_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(80) NOT NULL,
	"normalized_username" varchar(80) NOT NULL,
	"email" varchar(320) NOT NULL,
	"normalized_email" varchar(320) NOT NULL,
	"password_hash" text,
	"display_name" varchar(160) NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"locale" varchar(16) DEFAULT 'en' NOT NULL,
	"appearance" "appearance" DEFAULT 'system' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_aliases" ADD CONSTRAINT "page_aliases_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_aliases" ADD CONSTRAINT "page_aliases_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_categories" ADD CONSTRAINT "page_categories_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_categories" ADD CONSTRAINT "page_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_drafts" ADD CONSTRAINT "page_drafts_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_drafts" ADD CONSTRAINT "page_drafts_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_page_id_pages_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_deleted_by_id_users_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_index" ADD CONSTRAINT "search_index_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_index" ADD CONSTRAINT "search_index_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "audit_logs_site_time_idx" ON "audit_logs" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_site_slug_unique" ON "categories" USING btree ("site_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "email_verification_token_hash_unique" ON "email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_site_normalized_name_unique" ON "groups" USING btree ("site_id","normalized_name");--> statement-breakpoint
CREATE INDEX "media_assets_hash_idx" ON "media_assets" USING btree ("site_id","content_hash");--> statement-breakpoint
CREATE INDEX "media_assets_filename_idx" ON "media_assets" USING btree ("site_id","safe_filename");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_unique" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "page_aliases_site_slug_unique" ON "page_aliases" USING btree ("site_id","alias_slug");--> statement-breakpoint
CREATE INDEX "page_aliases_page_idx" ON "page_aliases" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_categories_category_idx" ON "page_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_drafts_page_editor_unique" ON "page_drafts" USING btree ("page_id","editor_id");--> statement-breakpoint
CREATE INDEX "page_links_target_idx" ON "page_links" USING btree ("target_page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_revisions_page_number_unique" ON "page_revisions" USING btree ("page_id","revision_number");--> statement-breakpoint
CREATE INDEX "page_revisions_page_idx" ON "page_revisions" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_revisions_editor_idx" ON "page_revisions" USING btree ("editor_id");--> statement-breakpoint
CREATE INDEX "page_revisions_hash_idx" ON "page_revisions" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_slug_unique" ON "pages" USING btree ("site_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_normalized_title_unique" ON "pages" USING btree ("site_id","normalized_title");--> statement-breakpoint
CREATE INDEX "pages_status_idx" ON "pages" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "pages_creator_idx" ON "pages" USING btree ("creator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "password_reset_token_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "rate_limit_events_key_idx" ON "rate_limit_events" USING btree ("scope","key_hash","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_site_normalized_name_unique" ON "roles" USING btree ("site_id","normalized_name");--> statement-breakpoint
CREATE INDEX "search_index_site_idx" ON "search_index" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "search_index_vector_idx" ON "search_index" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "site_settings_site_idx" ON "site_settings" USING btree ("site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_slug_unique" ON "sites" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_username_unique" ON "users" USING btree ("normalized_username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_unique" ON "users" USING btree ("normalized_email");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");