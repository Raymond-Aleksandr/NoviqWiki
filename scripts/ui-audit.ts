import {
  chromium,
  webkit,
  type BrowserContextOptions,
  type BrowserType,
  type Page
} from "playwright";

type ViewportCase = {
  name: string;
  width: number;
  height: number;
};

type Failure = {
  kind: string;
  browserName?: string;
  sizeName?: string;
  route?: string;
  detail?: unknown;
};

type RectSummary = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

type ElementSummary = {
  tag: string;
  className: string;
  label: string;
  rect: RectSummary;
};

type RouteMetrics = {
  bodyScrollWidth: number;
  clientWidth: number;
  overflowElements: ElementSummary[];
  smallTargets: ElementSummary[];
  tinyFormControls: ElementSummary[];
  badFileInputs: ElementSummary[];
  visibleDialogs: ElementSummary[];
  commandButtonsWithoutIcons: ElementSummary[];
  adminSettingsLinks: ElementSummary[];
  adminTabsWithoutIcons: ElementSummary[];
  createAnchors: ElementSummary[];
};

type ModalMetrics = {
  hasDialog: boolean;
  hasBackdrop: boolean;
  radius: string | null;
  overflow: boolean;
};

type Credentials = {
  username: string;
  password: string;
};

type AuditStorageState = Exclude<NonNullable<BrowserContextOptions["storageState"]>, string>;

const baseUrl = process.env.UI_AUDIT_BASE_URL ?? "http://localhost:3100";
const credentials =
  process.env.UI_AUDIT_USERNAME && process.env.UI_AUDIT_PASSWORD
    ? {
        username: process.env.UI_AUDIT_USERNAME,
        password: process.env.UI_AUDIT_PASSWORD
      }
    : null;

const viewports: ViewportCase[] = [
  { name: "desktop", width: 1280, height: 820 },
  { name: "mobile", width: 439, height: 734 }
];

const publicRoutes = [
  "/",
  "/search?q=E2E",
  "/recent",
  "/categories",
  "/media",
  "/login",
  "/forgot-password",
  "/reset-password?token=ui-audit",
  "/verify-email?token=ui-audit"
];

const authenticatedRoutes = [
  "/admin",
  "/admin/pages",
  "/admin/users",
  "/admin/groups",
  "/admin/roles",
  "/admin/media",
  "/admin/settings",
  "/admin/audit",
  "/admin/status"
];

const failures: Failure[] = [];

function addFailure(failure: Failure) {
  failures.push(failure);
}

async function main() {
  const storageState = credentials ? await createAuthState(credentials) : undefined;
  const articleSlug =
    process.env.UI_AUDIT_ARTICLE_SLUG ?? (await discoverArticleSlug(storageState));

  if (!credentials) {
    console.log("UI audit: no UI_AUDIT_USERNAME/UI_AUDIT_PASSWORD set; skipping auth routes.");
  }
  if (!articleSlug) {
    console.log("UI audit: no article slug discovered; skipping article/editor modal routes.");
  }

  const browserMatrix: Array<[string, BrowserType]> = [
    ["chromium", chromium],
    ["webkit", webkit]
  ];

  for (const [browserName, browserType] of browserMatrix) {
    const browser = await browserType.launch();
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState
      });
      const page = await context.newPage();
      for (const route of buildRoutes(articleSlug, Boolean(storageState))) {
        await auditRoute(page, route, browserName, viewport.name);
      }
      if (articleSlug) {
        const diffRoute = await discoverDiffRoute(page, articleSlug);
        if (diffRoute) {
          await auditRoute(page, diffRoute, browserName, viewport.name);
        }
      }
      await auditActiveState(page, browserName, viewport.name);
      if (storageState && articleSlug) {
        await auditMediaPicker(page, articleSlug, browserName, viewport.name);
      }
      if (storageState) {
        await auditConfirmDialog(page, browserName, viewport.name);
      }
      await context.close();
    }
    await browser.close();
  }

  if (failures.length > 0) {
    const counts = failures.reduce<Record<string, number>>((accumulator, failure) => {
      accumulator[failure.kind] = (accumulator[failure.kind] ?? 0) + 1;
      return accumulator;
    }, {});
    console.error(JSON.stringify({ total: failures.length, counts, failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(
    "UI audit passed: no overflow, duplicate admin controls, stray dialogs, tiny controls, iconless command buttons, or active-state transform drift."
  );
}

function buildRoutes(articleSlug: string | undefined, includeAuthenticated: boolean) {
  const routes = [...publicRoutes];
  if (articleSlug) {
    routes.push(`/page/${articleSlug}`, `/history/${articleSlug}`);
  }
  if (includeAuthenticated) {
    routes.push(...authenticatedRoutes);
    if (articleSlug) {
      routes.push(`/edit/${articleSlug}`);
    }
  }
  return routes;
}

async function createAuthState(credentials: Credentials): Promise<AuditStorageState> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="identifier"]').fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);
  await Promise.all([
    page
      .waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
      .catch(() => null),
    page.locator("form button.primary").click()
  ]);

  if (new URL(page.url()).pathname.includes("/login")) {
    const messages = await page
      .locator('[role="status"], .error, .notice')
      .allTextContents()
      .catch(() => []);
    await browser.close();
    throw new Error(
      `UI audit login failed: ${messages.filter(Boolean).join(" ") || "still on /login"}`
    );
  }

  const storageState = await context.storageState();
  await browser.close();
  return storageState;
}

async function discoverArticleSlug(storageState: AuditStorageState | undefined) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/pages?status=published&pageSize=1`, {
      headers: cookieHeader(storageState)
    });
    if (!response.ok) {
      return undefined;
    }
    const body: unknown = await response.json();
    return extractFirstSlug(body);
  } catch {
    return undefined;
  }
}

function cookieHeader(storageState: AuditStorageState | undefined): Record<string, string> {
  if (!storageState) {
    return {};
  }
  const host = new URL(baseUrl).hostname;
  const cookieValue = storageState.cookies
    .filter((cookie) => domainMatches(host, cookie.domain))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  return cookieValue ? { cookie: cookieValue } : {};
}

function domainMatches(host: string, domain: string) {
  const normalizedDomain = domain.replace(/^\./, "");
  return host === normalizedDomain || host.endsWith(`.${normalizedDomain}`);
}

function extractFirstSlug(body: unknown) {
  if (!isRecord(body)) {
    return undefined;
  }
  const data = body.data;
  if (!isRecord(data) || !Array.isArray(data.pages)) {
    return undefined;
  }
  const firstPage = data.pages.find(isRecord);
  return typeof firstPage?.slug === "string" ? firstPage.slug : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function auditRoute(page: Page, route: string, browserName: string, sizeName: string) {
  const response = await page
    .goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" })
    .catch((error: unknown) => {
      addFailure({
        kind: "navigation_error",
        browserName,
        sizeName,
        route,
        detail: error instanceof Error ? error.message : String(error)
      });
      return null;
    });
  if (!response) {
    return;
  }
  if (response.status() >= 500) {
    addFailure({ kind: "server_error", browserName, sizeName, route, detail: response.status() });
  }
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => null);
  const metrics = await readRouteMetrics(page);

  if (metrics.bodyScrollWidth > metrics.clientWidth + 2) {
    addFailure({
      kind: "horizontal_overflow",
      browserName,
      sizeName,
      route,
      detail: {
        bodyScrollWidth: metrics.bodyScrollWidth,
        clientWidth: metrics.clientWidth,
        elements: metrics.overflowElements
      }
    });
  }
  recordElementFailures("small_targets", metrics.smallTargets, browserName, sizeName, route);
  recordElementFailures(
    "tiny_form_controls",
    metrics.tinyFormControls,
    browserName,
    sizeName,
    route
  );
  recordElementFailures("bad_file_inputs", metrics.badFileInputs, browserName, sizeName, route);
  recordElementFailures("stray_dialogs", metrics.visibleDialogs, browserName, sizeName, route);
  recordElementFailures(
    "command_buttons_without_icons",
    metrics.commandButtonsWithoutIcons,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "admin_tabs_without_icons",
    metrics.adminTabsWithoutIcons,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "duplicate_create_anchors",
    metrics.createAnchors,
    browserName,
    sizeName,
    route
  );

  if (
    new URL(page.url()).pathname.startsWith("/admin") &&
    metrics.adminSettingsLinks.length !== 1
  ) {
    addFailure({
      kind: "admin_settings_link_count",
      browserName,
      sizeName,
      route,
      detail: metrics.adminSettingsLinks
    });
  }
}

async function discoverDiffRoute(page: Page, articleSlug: string) {
  const response = await page
    .goto(`${baseUrl}/history/${articleSlug}`, { waitUntil: "domcontentloaded" })
    .catch(() => null);
  if (!response || response.status() >= 400) {
    return undefined;
  }
  return page.locator('a[href^="/diff/"]').first().getAttribute("href");
}

function recordElementFailures(
  kind: string,
  elements: ElementSummary[],
  browserName: string,
  sizeName: string,
  route: string
) {
  if (elements.length > 0) {
    addFailure({ kind, browserName, sizeName, route, detail: elements });
  }
}

async function readRouteMetrics(page: Page): Promise<RouteMetrics> {
  return page.evaluate(`(() => {
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };
    const labelOf = (element) =>
      (
        element.getAttribute("aria-label") ??
        element.innerText ??
        element.textContent ??
        element.getAttribute("title") ??
        ""
      )
        .replace(/\\s+/g, " ")
        .trim();
    const summarize = (element) => ({
      tag: element.tagName,
      className: element.getAttribute("class") ?? "",
      label: labelOf(element).slice(0, 100),
      rect: rectOf(element)
    });
    const visibleMatches = (selector) =>
      [...document.querySelectorAll(selector)].filter(visible);
    const clientWidth = document.documentElement.clientWidth;

    const commandButtonsWithoutIcons = visibleMatches("button, a.button, [role='button']")
      .filter(
        (element) =>
          !element.closest(".segmented-control") &&
          !element.closest(".media-grid") &&
          !element.closest(".media-picker-grid") &&
          !element.closest(".cm-editor") &&
          !element.closest(".search-filter-list") &&
          !element.classList.contains("editor-tool-button")
      )
      .filter((element) => labelOf(element) && !element.querySelector("svg"))
      .map(summarize)
      .slice(0, 12);

    const smallTargetSelectors = [
      "button",
      "a.button",
      ".nav-list a",
      ".admin-tabs a",
      ".aside-actions a",
      ".category-list a",
      ".search-filter-link",
      ".search-result",
      ".page-list-row",
      ".backlink-row",
      ".feature-card"
    ].join(",");

    return {
      bodyScrollWidth: document.body.scrollWidth,
      clientWidth,
      overflowElements: visibleMatches("body *")
        .filter((element) => element.getBoundingClientRect().right > clientWidth + 2)
        .map(summarize)
        .slice(0, 8),
      smallTargets: visibleMatches(smallTargetSelectors)
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 32 || rect.height < 32;
        })
        .map(summarize)
        .slice(0, 12),
      tinyFormControls: visibleMatches("input[type='checkbox'], input[type='radio']")
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 18 || rect.height < 18;
        })
        .map(summarize)
        .slice(0, 12),
      badFileInputs: visibleMatches("input[type='file']")
        .filter((element) => element.getBoundingClientRect().height < 40)
        .map(summarize)
        .slice(0, 12),
      visibleDialogs: visibleMatches("[role='dialog'], .modal-backdrop, [popover]")
        .map(summarize)
        .slice(0, 12),
      commandButtonsWithoutIcons,
      adminSettingsLinks: visibleMatches("a[href='/admin/settings']").map(summarize),
      adminTabsWithoutIcons: visibleMatches(".admin-tabs a")
        .filter((element) => !element.querySelector("svg"))
        .map(summarize),
      createAnchors: visibleMatches("a[href='#create-group'], a[href='#create-role']").map(
        summarize
      )
    };
  })()`) as Promise<RouteMetrics>;
}

async function auditActiveState(page: Page, browserName: string, sizeName: string) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  const target = (await page.evaluate(`(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    };
    const element = [...document.querySelectorAll("button, a.button")].find(
      (candidate) => visible(candidate) && !candidate.closest(".segmented-control")
    );
    if (!element) {
      return null;
    }
    element.setAttribute("data-ui-audit-active-target", "true");
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`)) as { x: number; y: number } | null;
  if (!target) {
    return;
  }
  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  const transform = (await page.evaluate(`(() => {
    const element = document.querySelector("[data-ui-audit-active-target]");
    return element ? getComputedStyle(element).transform : "none";
  })()`)) as string;
  await page.mouse.move(0, 0);
  await page.mouse.up();
  if (transform && transform !== "none") {
    addFailure({
      kind: "active_state_transform",
      browserName,
      sizeName,
      route: "/",
      detail: transform
    });
  }
}

async function auditMediaPicker(
  page: Page,
  articleSlug: string,
  browserName: string,
  sizeName: string
) {
  const response = await page.goto(`${baseUrl}/edit/${articleSlug}`, {
    waitUntil: "domcontentloaded"
  });
  if (response?.status() === 404) {
    return;
  }
  const buttons = page.locator(".editor-toolbar .editor-tool-button");
  const count = await buttons.count();
  if (count === 0) {
    return;
  }
  await buttons.nth(count - 1).click();
  const modal = await readModalMetrics(page, ".media-picker-dialog[role='dialog']");
  if (!modal.hasBackdrop || !modal.hasDialog || modal.radius !== "14px" || modal.overflow) {
    addFailure({
      kind: "media_picker_modal_mismatch",
      browserName,
      sizeName,
      route: `/edit/${articleSlug}`,
      detail: modal
    });
  }
}

async function auditConfirmDialog(page: Page, browserName: string, sizeName: string) {
  await page.goto(`${baseUrl}/admin/pages`, { waitUntil: "domcontentloaded" });
  const deleteButtons = page.locator("button.button.danger");
  if ((await deleteButtons.count()) === 0) {
    return;
  }
  await deleteButtons.first().click();
  const modal = await readModalMetrics(page, ".confirm-dialog[role='dialog']");
  if (!modal.hasBackdrop || !modal.hasDialog || modal.radius !== "14px" || modal.overflow) {
    addFailure({
      kind: "confirm_modal_mismatch",
      browserName,
      sizeName,
      route: "/admin/pages",
      detail: modal
    });
  }
}

async function readModalMetrics(page: Page, dialogSelector: string): Promise<ModalMetrics> {
  return page.evaluate(`(() => {
    const selector = ${JSON.stringify(dialogSelector)};
    const dialog = document.querySelector(selector);
    const backdrop = document.querySelector(".modal-backdrop");
    return {
      hasDialog: Boolean(dialog),
      hasBackdrop: Boolean(backdrop),
      radius: dialog ? getComputedStyle(dialog).borderRadius : null,
      overflow: document.body.scrollWidth > document.documentElement.clientWidth + 2
    };
  })()`) as Promise<ModalMetrics>;
}

void main();
