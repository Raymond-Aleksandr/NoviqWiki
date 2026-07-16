import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, sqlClient } from "@/db/client";
import { groups } from "@/db/schema";
import { getPrimarySiteWithSettings } from "@/db/site";
import { completeSetup } from "@/modules/setup/service";
import { createUser } from "@/modules/users/service";
import { assignUserToGroup } from "@/modules/authorization/permissions";
import { createPage, publishPage } from "@/modules/pages/service";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The seed command is disabled in production.");
  }

  let site = await getPrimarySiteWithSettings();
  if (!site) {
    await completeSetup({
      siteName: "NoviqWiki Development",
      tagline: "Development-only seed content",
      baseUrl: "http://localhost:3000",
      registrationMode: "open",
      mediaDriver: "local",
      ownerUsername: "owner",
      ownerEmail: "owner@example.local",
      ownerDisplayName: "Development Owner",
      ownerPassword: "OwnerPassword123"
    });
    console.log("Created development Owner: owner / OwnerPassword123");
    site = await getPrimarySiteWithSettings();
    if (!site) {
      throw new Error("Seed setup failed.");
    }
  }

  const editor = await createUser({
    username: "editor",
    email: "editor@example.local",
    displayName: "Development Editor",
    password: "EditorPassword123",
    status: "active"
  }).catch(async () => null);

  if (editor) {
    const [readerGroup] = await db
      .select()
      .from(groups)
      .where(eq(groups.normalizedName, "readers"))
      .limit(1);
    if (readerGroup) {
      await assignUserToGroup(editor.id, readerGroup.id);
    }
    console.log("Created development Editor: editor / EditorPassword123");
  }

  const actor = {
    id: editor?.id ?? "00000000-0000-0000-0000-000000000000",
    name: editor?.displayName ?? "Seeder"
  };

  const home = await createPage({
    siteId: site.site.id,
    title: "Home",
    markdown:
      "# Welcome to NoviqWiki\n\nThis seeded page demonstrates **Markdown**, [[Internal Links]], and [[Category:Guides]].\n\n- Immutable revisions\n- Full-text search\n- Categories\n\n```ts\nconsole.log('NoviqWiki');\n```\n",
    publish: true,
    actorId: actor.id,
    actorDisplayName: actor.name,
    editSummary: "Seed home page"
  }).catch(() => null);

  if (home && "page" in home) {
    await publishPage({
      pageId: home.page.id,
      baseRevisionId: home.page.currentRevisionId ?? null,
      markdown:
        "# Welcome to NoviqWiki\n\nThis seeded page demonstrates **Markdown**, [[Internal Links]], [[Search]], math $E=mc^2$, and [[Category:Guides]].\n\n- Immutable revisions\n- Full-text search\n- Categories\n- Rollback through history\n",
      actorId: actor.id,
      actorDisplayName: actor.name,
      editSummary: "Add more seed examples"
    }).catch(() => null);
  }

  await createPage({
    siteId: site.site.id,
    title: "Internal Links",
    markdown:
      "# Internal Links\n\nUse `[[Page Title]]` or `[[Page Title|visible text]]` to connect articles.\n\n[[Category:Guides]]\n",
    publish: true,
    actorId: actor.id,
    actorDisplayName: actor.name,
    editSummary: "Seed internal links article"
  }).catch(() => null);

  await createPage({
    siteId: site.site.id,
    title: "Search",
    markdown:
      "# Search\n\nNoviqWiki uses PostgreSQL full-text search for the baseline deployment.\n\n[[Category:Operations]]\n",
    publish: true,
    actorId: actor.id,
    actorDisplayName: actor.name,
    editSummary: "Seed search article"
  }).catch(() => null);

  console.log(
    "Seed complete. Development credentials are not created unless this command is run explicitly."
  );
  await sqlClient.end({ timeout: 5 });
}

void main();
