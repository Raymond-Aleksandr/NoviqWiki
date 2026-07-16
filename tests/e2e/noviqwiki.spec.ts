import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";

test.describe.configure({ mode: "serial" });

test("fresh setup and core wiki workflow", async ({ page }) => {
  await page.goto("/setup");
  await page.getByLabel("Site name").fill("NoviqWiki E2E");
  await page.getByLabel("Tagline").fill("End-to-end wiki");
  await page.getByLabel("Base URL").fill("http://127.0.0.1:3000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Access" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Storage" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Owner" })).toBeVisible();
  await page.getByLabel("Username").fill("owner");
  await page.getByRole("textbox", { name: "Email" }).fill("owner@example.test");
  await page.getByLabel("Display name").fill("Owner");
  await page.getByLabel("Password").fill("OwnerPassword123");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await page.getByRole("button", { name: "Complete setup" }).click();
  await expect(page.getByRole("heading", { name: "NoviqWiki E2E" })).toBeVisible();

  await page.goto("/edit/new");
  await page.getByLabel("Page title").fill("E2E Article");
  await page.locator(".cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("# E2E Article\n\nInitial searchable body.\n\n[[Category:Testing]]");
  await page.getByLabel("Edit summary").fill("Initial publish");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/page\/e2e-article/);
  await expect(page.getByRole("heading", { name: "E2E Article" }).first()).toBeVisible();
  await expect(page.locator(".article-body")).toContainText("Initial searchable body.");

  await page.goto("/edit/e2e-article");
  await page.locator(".cm-content").click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(
    "# E2E Article\n\nUpdated searchable body for rollback.\n\n[[Category:Testing]]"
  );
  await page.getByLabel("Edit summary").fill("Update body");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published revision 2.")).toBeVisible();

  await page.goto("/history/e2e-article");
  await expect(page.getByRole("heading", { name: "History · E2E Article" })).toBeVisible();
  await page.getByRole("link", { name: "Compare" }).first().click();
  await expect(page.getByRole("heading", { name: /Compare revision/ })).toBeVisible();
  await expect(page.locator(".diff-add")).toContainText("Updated searchable body");

  await page.goto("/history/e2e-article");
  await page.getByRole("button", { name: "Rollback" }).last().click();
  await expect(page.locator(".article-body")).toContainText("Initial searchable body.");

  await page.goto("/search?q=Initial");
  await expect(page.getByRole("link", { name: "E2E Article" })).toBeVisible();
});

test("media upload, user administration, and mobile article layout", async ({
  page,
  browserName
}) => {
  await page.goto("/login");
  if (
    await page
      .getByLabel("Username or email")
      .isVisible()
      .catch(() => false)
  ) {
    await page.getByLabel("Username or email").fill("owner");
    await page.getByLabel("Password").fill("OwnerPassword123");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  }

  const fixture = path.join(process.cwd(), "test-results", `upload-${browserName}.png`);
  await writeFile(
    fixture,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64"
    )
  );

  await page.goto("/media");
  await page.getByLabel("File").setInputFiles(fixture);
  await page.getByLabel("Alt text").fill("Tiny pixel");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.locator(".media-grid").getByText(`upload-${browserName}.png`)).toBeVisible();

  await page.goto("/admin/users");
  await page.getByLabel("Username").fill(`viewer-${browserName}`);
  await page.getByRole("textbox", { name: "Email" }).fill(`viewer-${browserName}@example.test`);
  await page.getByLabel("Display name").fill("Viewer");
  await page.getByLabel("Password").fill("ViewerPassword123");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("User created.")).toBeVisible();
  await expect(page.getByText(`viewer-${browserName}`, { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 840 });
  await page.goto("/page/e2e-article");
  await expect(page.getByRole("heading", { name: "E2E Article" }).first()).toBeVisible();
});
