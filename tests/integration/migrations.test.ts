import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("database migrations", () => {
  it("backfills unambiguous canonical aliases for legacy custom-slug pages", async () => {
    const client = new PGlite();
    try {
      await applyMigration(client, "drizzle/0000_peaceful_shiva.sql");
      await applyMigration(client, "drizzle/0001_short_rick_jones.sql");
      await client.exec(`
        insert into sites (id, name, slug, setup_complete)
        values ('00000000-0000-4000-8000-000000000001', 'Migration Wiki', 'migration-wiki', true);

        insert into pages (id, site_id, title, normalized_title, slug, status)
        values
          ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Café Notes', 'café notes', 'custom-cafe', 'published'),
          ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Blocked Title', 'blocked title', 'custom-blocked', 'published'),
          ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Actual Occupant', 'actual occupant', 'blocked-title', 'published'),
          ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Reserved Alias', 'reserved alias', 'custom-reserved', 'published'),
          ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Alias Owner', 'alias owner', 'alias-owner', 'published'),
          ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'A B', 'a b', 'custom-a-b-one', 'published'),
          ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'A-B', 'a-b', 'custom-a-b-two', 'published');

        insert into page_aliases (site_id, page_id, alias_slug, alias_title)
        values (
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000105',
          'reserved-alias',
          'Reserved Alias'
        );
      `);

      await applyMigration(client, "drizzle/0002_red_jigsaw.sql");

      const aliases = await client.query<{ page_id: string; alias_slug: string }>(`
        select page_id, alias_slug
        from page_aliases
        where page_id in (
          '00000000-0000-4000-8000-000000000101',
          '00000000-0000-4000-8000-000000000102',
          '00000000-0000-4000-8000-000000000104',
          '00000000-0000-4000-8000-000000000106',
          '00000000-0000-4000-8000-000000000107'
        )
        order by page_id, alias_slug;
      `);
      expect(aliases.rows).toEqual([
        {
          page_id: "00000000-0000-4000-8000-000000000101",
          alias_slug: "cafe-notes"
        }
      ]);
    } finally {
      await client.close();
    }
  });
});

async function applyMigration(client: PGlite, file: string) {
  const migration = await readFile(file, "utf8");
  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await client.exec(statement);
  }
}
