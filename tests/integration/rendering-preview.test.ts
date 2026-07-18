import { describe, expect, it } from "vitest";
import { createPage } from "@/modules/pages/service";
import { renderEditorPreview } from "@/modules/rendering/preview";
import { completeSetup } from "@/modules/setup/service";
import { createTestDatabase } from "../helpers/test-db";

describe("editor Markdown preview", () => {
  it("uses the canonical renderer and resolves current wiki-link state", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Preview Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-preview@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );
    await createPage(
      {
        siteId: setup.site.id,
        title: "Existing Target",
        markdown: "# Existing Target",
        publish: true,
        actorId: setup.owner.id,
        actorDisplayName: setup.owner.displayName
      },
      test.db
    );

    const preview = await renderEditorPreview(
      {
        siteId: setup.site.id,
        markdown: [
          "# Preview",
          "",
          "![Example](https://example.com/image.png)",
          "",
          "[External](https://example.com)",
          "",
          "- [x] complete",
          "",
          "| A | B |",
          "| - | - |",
          "| 1 | 2 |",
          "",
          "$E=mc^2$",
          "",
          "```ts",
          "const value = 1;",
          "```",
          "",
          "[[Existing Target|existing]] and [[Missing Target|missing]]",
          "",
          "<script>alert(1)</script>"
        ].join("\n"),
        canCreatePage: true
      },
      test.executor
    );

    expect(preview.html).toContain('<img src="https://example.com/image.png" alt="Example">');
    expect(preview.html).toContain('<a href="https://example.com">External</a>');
    expect(preview.html).toContain("<table>");
    expect(preview.html).toContain("katex");
    expect(preview.html).toContain("language-ts");
    expect(preview.html).not.toContain("<script>");
    expect(preview.html).toContain('href="/page/existing-target"');
    expect(preview.html).toContain('class="wiki-link wiki-link-exists"');
    expect(preview.html).toContain('href="/edit/new?title=Missing%20Target"');
    expect(preview.html).toContain('class="wiki-link wiki-link-missing"');
  });

  it("keeps missing preview links read-only without create permission", async () => {
    const test = await createTestDatabase();
    const setup = await completeSetup(
      {
        siteName: "Read-only Preview Wiki",
        tagline: "Test",
        baseUrl: "http://localhost:3000",
        registrationMode: "closed",
        mediaDriver: "local",
        ownerUsername: "owner",
        ownerEmail: "owner-readonly-preview@example.test",
        ownerPassword: "OwnerPassword123"
      },
      test.db
    );

    const preview = await renderEditorPreview(
      {
        siteId: setup.site.id,
        markdown: "[[Missing Target|missing]]",
        canCreatePage: false
      },
      test.executor
    );

    expect(preview.html).toContain('href="/page/missing-target"');
    expect(preview.html).not.toContain("/edit/new");
    expect(preview.html).toContain('data-wiki-state="missing"');
  });
});
