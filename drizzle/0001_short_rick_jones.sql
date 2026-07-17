CREATE TABLE "page_watchlist" (
	"site_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_watchlist_user_id_page_id_pk" PRIMARY KEY("user_id","page_id")
);
--> statement-breakpoint
ALTER TABLE "page_watchlist" ADD CONSTRAINT "page_watchlist_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_watchlist" ADD CONSTRAINT "page_watchlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_watchlist" ADD CONSTRAINT "page_watchlist_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_watchlist_site_user_idx" ON "page_watchlist" USING btree ("site_id","user_id");--> statement-breakpoint
CREATE INDEX "page_watchlist_page_idx" ON "page_watchlist" USING btree ("page_id");