CREATE TABLE "rate_limit_buckets" (
	"scope" varchar(80) NOT NULL,
	"key_hash" varchar(128) NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_scope_key_hash_pk" PRIMARY KEY("scope","key_hash")
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_updated_idx" ON "rate_limit_buckets" USING btree ("updated_at");
--> statement-breakpoint
WITH "canonical_alias_candidates" AS (
	SELECT
		"pages"."site_id",
		"pages"."id" AS "page_id",
		"pages"."title" AS "alias_title",
		"pages"."slug" AS "page_slug",
		COALESCE(
			NULLIF(
				regexp_replace(
					regexp_replace(
						regexp_replace(
							lower(btrim(normalize("pages"."title", NFKD))),
							U&'[\0300-\036f]',
							'',
							'g'
						),
						U&'[^a-z0-9\4e00-\9fff]+',
						'-',
						'g'
					),
					'(^-+|-+$)',
					'',
					'g'
				),
				''
			),
			'page'
		) AS "alias_slug"
	FROM "pages"
),
"deduplicated_alias_candidates" AS (
	SELECT
		"canonical_alias_candidates".*,
		count(*) OVER (
			PARTITION BY
				"canonical_alias_candidates"."site_id",
				"canonical_alias_candidates"."alias_slug"
		) AS "candidate_count"
	FROM "canonical_alias_candidates"
	WHERE "canonical_alias_candidates"."alias_slug" <> "canonical_alias_candidates"."page_slug"
)
INSERT INTO "page_aliases" ("site_id", "page_id", "alias_slug", "alias_title")
SELECT
	"candidate"."site_id",
	"candidate"."page_id",
	"candidate"."alias_slug",
	"candidate"."alias_title"
FROM "deduplicated_alias_candidates" AS "candidate"
WHERE "candidate"."candidate_count" = 1
	AND NOT EXISTS (
		SELECT 1
		FROM "pages" AS "occupied_page"
		WHERE "occupied_page"."site_id" = "candidate"."site_id"
			AND "occupied_page"."slug" = "candidate"."alias_slug"
	)
	AND NOT EXISTS (
		SELECT 1
		FROM "page_aliases" AS "occupied_alias"
		WHERE "occupied_alias"."site_id" = "candidate"."site_id"
			AND "occupied_alias"."alias_slug" = "candidate"."alias_slug"
	)
ON CONFLICT DO NOTHING;
