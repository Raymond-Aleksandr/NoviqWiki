import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  chromium,
  webkit,
  type BrowserContextOptions,
  type BrowserType,
  type ElementHandle,
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

type SourceMatch = {
  file: string;
  line: number;
  pattern: string;
  text: string;
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
  oversizedFormControls: ElementSummary[];
  controlTypographyMismatches: ElementSummary[];
  formLabelTypographyMismatches: ElementSummary[];
  oversizedFilterBars: ElementSummary[];
  segmentedControlMismatches: ElementSummary[];
  badFileInputs: ElementSummary[];
  controlTextOverflow: ElementSummary[];
  textContentOverflow: ElementSummary[];
  articleContainerOverflow: ElementSummary[];
  articleMediaOverflow: ElementSummary[];
  articleMediaTooTall: ElementSummary[];
  visibleDialogs: ElementSummary[];
  commandButtonsWithoutIcons: ElementSummary[];
  iconOnlyControlsWithoutNames: ElementSummary[];
  buttonIconSizeMismatches: ElementSummary[];
  buttonIconSpacingMismatches: ElementSummary[];
  commandButtonSizeMismatches: ElementSummary[];
  oversizedText: ElementSummary[];
  overlappingActivityRows: ElementSummary[];
  duplicateTimelineActions: ElementSummary[];
  unevenAdminPageActions: ElementSummary[];
  unevenHistoryActions: ElementSummary[];
  misalignedHistoryRows: ElementSummary[];
  stackedHistoryCurrentBadges: ElementSummary[];
  adminSettingsLinks: ElementSummary[];
  adminTabsWithoutIcons: ElementSummary[];
  createAnchors: ElementSummary[];
  rawAuditActions: string[];
  unlocalizedRevisionSummaries: string[];
  unlocalizedAuthorizationLabels: ElementSummary[];
  unlocalizedFieldTerms: ElementSummary[];
  unlocalizedProductText: ElementSummary[];
};

type ModalMetrics = {
  hasDialog: boolean;
  hasBackdrop: boolean;
  radius: string | null;
  overflow: boolean;
  warningTextAlign: string | null;
};

type DesignTokenMetrics = {
  theme: string | undefined;
  tokens: Record<string, string>;
  bodyFont: string;
  serifFont: string;
  monoFont: string;
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
  { name: "mobile", width: 439, height: 734 },
  { name: "narrow-mobile", width: 390, height: 844 }
];

const expectedLightTokens = {
  "--bg": "#f6f7f9",
  "--surface": "#ffffff",
  "--surface-muted": "#eaedf0",
  "--surface-sunken": "#e5e8ec",
  "--text": "#1e2328",
  "--primary": "#2c5f8f",
  "--border": "#d4d9df",
  "--nw-radius": "8px"
};

const expectedDarkTokens = {
  "--bg": "#16181a",
  "--surface": "#212528",
  "--surface-muted": "#2b3033",
  "--surface-sunken": "#121416",
  "--text": "#e9edef",
  "--primary": "#6fa2d0",
  "--border": "#333a3e",
  "--nw-radius": "8px"
};

const sourceExtensions = new Set([".css", ".ts", ".tsx"]);

const nativeDialogPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: "window.alert", pattern: /\bwindow\s*\.\s*alert\s*\(/ },
  { label: "window.confirm", pattern: /\bwindow\s*\.\s*confirm\s*\(/ },
  { label: "window.prompt", pattern: /\bwindow\s*\.\s*prompt\s*\(/ },
  { label: "global alert", pattern: /(^|[^\w.])alert\s*\(/ },
  { label: "global confirm", pattern: /(^|[^\w.])confirm\s*\(/ },
  { label: "global prompt", pattern: /(^|[^\w.])prompt\s*\(/ },
  { label: "beforeunload", pattern: /\b(onbeforeunload|beforeunload)\b/ }
];

const typographyDriftPatterns: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "nonzero letter-spacing",
    pattern: /\bletter-spacing\s*:\s*(?!\s*0(?:\.0+)?(?:px|em|rem)?\s*[;}])[^;}]+[;}]/i
  },
  {
    label: "viewport font-size",
    pattern: /\bfont-size\s*:\s*[^;}]*\b(?:vw|vh|vmin|vmax)\b[^;}]*[;}]/i
  },
  {
    label: "dynamic font-size",
    pattern: /\bfont-size\s*:\s*(?:clamp|calc)\([^;}]+[;}]/i
  },
  {
    label: "raw font-family",
    pattern: /\bfont-family\s*:\s*(?!\s*var\(--nw-font-(?:body|serif|mono)\)\s*[;}])[^;}]+[;}]/i
  }
];

const rawColorLiteralPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/i;

const visualEffectDriftPatterns: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "raw box-shadow",
    pattern:
      /\bbox-shadow\s*:\s*(?!\s*(?:none|var\(--(?:sh-(?:sm|md|lg)|button-active-shadow)\))\s*[;}])[^;}]+[;}]/i
  },
  {
    label: "text-shadow",
    pattern: /\btext-shadow\s*:\s*(?!\s*none\s*[;}])[^;}]+[;}]/i
  },
  {
    label: "drop-shadow filter",
    pattern: /\bfilter\s*:\s*[^;}]*drop-shadow\([^;}]+[;}]/i
  }
];

const rawAuditActionValues = [
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
];

const rawAuditActionPattern = new RegExp(
  `\\b(?:${rawAuditActionValues.map(escapeRegExp).join("|")})\\b`,
  "g"
);

const unlocalizedProductTextPattern =
  /\b(?:Read|Recent changes|Categories|Media library|Special pages|Admin|Search|Create page|Clear filters|Previous page|Next page|Published|Draft|Archived|Deleted|Protected|Editable|Built-in|Custom|Media uploaded|Media deleted|Page published|Page edited|Page created|Page deleted|Page restored|Page rollback|Rollback|Setup complete|Auth login|Auth logout|Create account|Sign in|Log out|No role|No group|No assigned roles|Title|Slug|Status|Actions|Description|Name|Email|Role|Users|Groups|Roles|Audit log|Dashboard|Settings)\b/i;

const publicRoutes = [
  "/",
  "/search?q=E2E",
  "/recent",
  "/special",
  "/random",
  "/pages",
  "/wanted",
  "/orphaned",
  "/dead-end",
  "/short-pages",
  "/protected-pages",
  "/uncategorized",
  "/redirects",
  "/categories",
  "/media",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password?token=ui-audit",
  "/verify-email?token=ui-audit",
  "/setup"
];

const authenticatedRoutes = [
  "/watchlist",
  "/edit/new",
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

const auditedPageRoutes = new Set([
  "/",
  "/admin",
  "/admin/audit",
  "/admin/groups",
  "/admin/media",
  "/admin/pages",
  "/admin/roles",
  "/admin/settings",
  "/admin/status",
  "/admin/users",
  "/categories",
  "/categories/[slug]",
  "/dead-end",
  "/diff/[from]/[to]",
  "/edit/[slug]",
  "/edit/new",
  "/forgot-password",
  "/history/[slug]",
  "/login",
  "/media",
  "/orphaned",
  "/page/[slug]",
  "/page/[slug]/backlinks",
  "/page/[slug]/cite",
  "/pages",
  "/protected-pages",
  "/recent",
  "/redirects",
  "/register",
  "/reset-password",
  "/search",
  "/setup",
  "/short-pages",
  "/special",
  "/uncategorized",
  "/verify-email",
  "/wanted",
  "/watchlist"
]);

const failures: Failure[] = [];

function addFailure(failure: Failure) {
  failures.push(failure);
}

async function auditSourceForNativeDialogs() {
  const matches = await findNativeDialogMatches(path.join(process.cwd(), "src"));
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "native_browser_dialog_api",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForActiveTransforms() {
  const matches = await findActiveTransformMatches(path.join(process.cwd(), "src"));
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "active_state_source_transform",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForInlineStyles() {
  const matches = [
    ...(await findUnexpectedInlineStyleMatches(path.join(process.cwd(), "src/app"))),
    ...(await findUnexpectedInlineStyleMatches(path.join(process.cwd(), "src/components")))
  ];
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "unexpected_inline_style",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForTypographyDrift() {
  const matches = await findTypographyDriftMatches(path.join(process.cwd(), "src"));
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "typography_source_drift",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForColorDrift() {
  const matches = await findColorDriftMatches(path.join(process.cwd(), "src"));
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "color_source_drift",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForVisualEffectDrift() {
  const matches = await findVisualEffectDriftMatches(path.join(process.cwd(), "src"));
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "visual_effect_source_drift",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForHardcodedVisibleText() {
  const matches = [
    ...(await findUnexpectedHardcodedVisibleTextMatches(path.join(process.cwd(), "src/app"))),
    ...(await findUnexpectedHardcodedVisibleTextMatches(path.join(process.cwd(), "src/components")))
  ];
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "hardcoded_visible_text",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForI18nDictionaryShape() {
  const dictionaries = await Promise.all([
    readI18nDictionaryKeys(path.join(process.cwd(), "src/i18n/en.ts")),
    readI18nDictionaryKeys(path.join(process.cwd(), "src/i18n/zh-CN.ts"))
  ]);
  const [english, simplifiedChinese] = dictionaries;
  const failures = [
    ...english.duplicates.map((key) => ({
      file: english.file,
      line: english.linesByKey.get(key)?.[1] ?? english.linesByKey.get(key)?.[0] ?? 1,
      pattern: "duplicate i18n key",
      text: key
    })),
    ...simplifiedChinese.duplicates.map((key) => ({
      file: simplifiedChinese.file,
      line:
        simplifiedChinese.linesByKey.get(key)?.[1] ??
        simplifiedChinese.linesByKey.get(key)?.[0] ??
        1,
      pattern: "duplicate i18n key",
      text: key
    })),
    ...difference(english.keys, simplifiedChinese.keys).map((key) => ({
      file: simplifiedChinese.file,
      line: 1,
      pattern: "missing i18n key",
      text: key
    })),
    ...difference(simplifiedChinese.keys, english.keys).map((key) => ({
      file: simplifiedChinese.file,
      line: simplifiedChinese.linesByKey.get(key)?.[0] ?? 1,
      pattern: "extra i18n key",
      text: key
    }))
  ];
  if (failures.length === 0) {
    return;
  }
  addFailure({
    kind: "i18n_dictionary_shape_drift",
    detail: failures.slice(0, 30)
  });
}

async function auditSourceForI18nDefaultLocaleDrift() {
  const matches = await findI18nDefaultLocaleDriftMatches(path.join(process.cwd(), "src/app"));
  if (matches.length === 0) {
    return;
  }
  addFailure({
    kind: "i18n_default_locale_source_drift",
    detail: matches.slice(0, 20)
  });
}

async function auditSourceForPageRouteCoverage() {
  const routes = await findAppPageRoutes(path.join(process.cwd(), "src/app"));
  const missingRoutes = routes.filter((route) => !auditedPageRoutes.has(route));
  if (missingRoutes.length === 0) {
    return;
  }
  addFailure({
    kind: "ui_route_coverage_gap",
    detail: missingRoutes
  });
}

async function findNativeDialogMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findNativeDialogMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }
    const source = await readFile(entryPath, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { label, pattern } of nativeDialogPatterns) {
        if (pattern.test(line)) {
          matches.push({
            file: path.relative(process.cwd(), entryPath),
            line: index + 1,
            pattern: label,
            text: line.trim().slice(0, 160)
          });
        }
      }
    });
  }

  return matches;
}

async function findUnexpectedInlineStyleMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findUnexpectedInlineStyleMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".tsx") {
      continue;
    }
    const source = await readFile(entryPath, "utf8");
    const relativePath = path.relative(process.cwd(), entryPath);
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!line.includes("style={{") || isAllowedInlineStyle(relativePath, line)) {
        return;
      }
      matches.push({
        file: relativePath,
        line: index + 1,
        pattern: "inline style",
        text: line.trim().slice(0, 160)
      });
    });
  }

  return matches;
}

async function findAppPageRoutes(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      routes.push(...(await findAppPageRoutes(entryPath)));
      continue;
    }
    if (!entry.isFile() || entry.name !== "page.tsx") {
      continue;
    }
    routes.push(appPagePathToRoute(entryPath));
  }

  return routes.sort();
}

function appPagePathToRoute(pagePath: string) {
  const appRoot = path.join(process.cwd(), "src/app");
  const relative = path.relative(appRoot, pagePath).replaceAll(path.sep, "/");
  const route = relative.replace(/\/?page\.tsx$/, "");
  return route ? `/${route}` : "/";
}

async function findTypographyDriftMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findTypographyDriftMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".css") {
      continue;
    }
    const source = await readFile(entryPath, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { label, pattern } of typographyDriftPatterns) {
        if (pattern.test(line)) {
          matches.push({
            file: path.relative(process.cwd(), entryPath),
            line: index + 1,
            pattern: label,
            text: line.trim().slice(0, 160)
          });
        }
      }
    });
  }

  return matches;
}

async function findColorDriftMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findColorDriftMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".css") {
      continue;
    }
    const source = await readFile(entryPath, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!rawColorLiteralPattern.test(line) || isAllowedRawColorLine(line)) {
        return;
      }
      matches.push({
        file: path.relative(process.cwd(), entryPath),
        line: index + 1,
        pattern: "raw color literal",
        text: line.trim().slice(0, 160)
      });
    });
  }

  return matches;
}

async function findVisualEffectDriftMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findVisualEffectDriftMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".css") {
      continue;
    }
    const source = await readFile(entryPath, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { label, pattern } of visualEffectDriftPatterns) {
        if (pattern.test(line)) {
          matches.push({
            file: path.relative(process.cwd(), entryPath),
            line: index + 1,
            pattern: label,
            text: line.trim().slice(0, 160)
          });
        }
      }
    });
  }

  return matches;
}

function isAllowedRawColorLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("--") || trimmed.includes("data:image/");
}

async function readI18nDictionaryKeys(filePath: string) {
  const source = await readFile(filePath, "utf8");
  const relativeFile = path.relative(process.cwd(), filePath);
  const linesByKey = new Map<string, number[]>();
  source.split(/\r?\n/).forEach((line, index) => {
    const match = /^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:/.exec(line);
    if (!match) {
      return;
    }
    const key = match[1];
    linesByKey.set(key, [...(linesByKey.get(key) ?? []), index + 1]);
  });
  const keys = new Set(linesByKey.keys());
  const duplicates = [...linesByKey.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([key]) => key);
  return {
    file: relativeFile,
    keys,
    linesByKey,
    duplicates
  };
}

function difference(left: Set<string>, right: Set<string>) {
  return [...left].filter((item) => !right.has(item));
}

async function findI18nDefaultLocaleDriftMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findI18nDefaultLocaleDriftMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || !["actions.ts", "page.tsx"].includes(entry.name)) {
      continue;
    }

    const relativePath = path.relative(process.cwd(), entryPath);
    if (isAllowedBareRequestI18nPage(relativePath)) {
      continue;
    }

    const source = await readFile(entryPath, "utf8");
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!/\bgetRequestI18n\s*\(\s*\)/.test(line)) {
        return;
      }
      matches.push({
        file: relativePath,
        line: index + 1,
        pattern: "bare getRequestI18n()",
        text: line.trim().slice(0, 160)
      });
    });
  }

  return matches;
}

function isAllowedBareRequestI18nPage(relativePath: string) {
  return relativePath === "src/app/setup/page.tsx";
}

async function findUnexpectedHardcodedVisibleTextMatches(
  directory: string
): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findUnexpectedHardcodedVisibleTextMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".tsx") {
      continue;
    }
    const source = await readFile(entryPath, "utf8");
    const relativePath = path.relative(process.cwd(), entryPath);
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of hardcodedVisibleTextMatches(line)) {
        if (isAllowedHardcodedVisibleText(relativePath, match.text)) {
          continue;
        }
        matches.push({
          file: relativePath,
          line: index + 1,
          pattern: match.pattern,
          text: line.trim().slice(0, 160)
        });
      }
    });
  }

  return matches;
}

function hardcodedVisibleTextMatches(line: string): Array<{ pattern: string; text: string }> {
  if (isNonJsxSourceLine(line)) {
    return [];
  }

  const matches: Array<{ pattern: string; text: string }> = [];
  const jsxTextPatterns: Array<{ pattern: string; regex: RegExp }> = [
    { pattern: "JSX text node", regex: /<[A-Za-z][^>]*>\s*([^<{}`]*[A-Za-z][^<{}`]*)\s*<\//g },
    { pattern: "JSX text after icon", regex: /<[A-Za-z][^>]*\/>\s*([^<{}`]*[A-Za-z][^<{}`]*)$/g },
    {
      pattern: "literal accessibility text",
      regex: /\b(?:aria-label|placeholder|title)\s*=\s*["']([^"']*[A-Za-z][^"']*)["']/g
    }
  ];

  for (const { pattern, regex } of jsxTextPatterns) {
    for (const match of line.matchAll(regex)) {
      const text = normalizeHardcodedVisibleText(match[1] ?? "");
      if (!text || isAllowedLiteralExample(text)) {
        continue;
      }
      matches.push({ pattern, text });
    }
  }

  return matches;
}

function isNonJsxSourceLine(line: string) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("import ") ||
    trimmed.startsWith("type ") ||
    trimmed.startsWith("export type ") ||
    trimmed.startsWith("interface ") ||
    trimmed.includes("=> Promise<") ||
    trimmed.includes("?:")
  );
}

function normalizeHardcodedVisibleText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isAllowedLiteralExample(value: string) {
  return value.startsWith("/") || value.startsWith("#") || value.startsWith(".");
}

function isAllowedHardcodedVisibleText(_relativePath: string, value: string) {
  return ["Drizzle", "v0.1.0", "NoviqWiki"].includes(value);
}

function isAllowedInlineStyle(relativePath: string, line: string) {
  return (
    (relativePath === "src/components/setup/setup-wizard.tsx" &&
      line.includes("style={{ inlineSize:")) ||
    (relativePath === "src/components/article/article-view.tsx" &&
      line.includes("style={{ paddingLeft:"))
  );
}

async function findActiveTransformMatches(directory: string): Promise<SourceMatch[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches: SourceMatch[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findActiveTransformMatches(entryPath)));
      continue;
    }
    if (!entry.isFile() || path.extname(entry.name) !== ".css") {
      continue;
    }

    const source = await readFile(entryPath, "utf8");
    const lines = source.split(/\r?\n/);
    let selectorBuffer = "";
    let activeRuleDepth = 0;

    lines.forEach((line, index) => {
      const opens = countCharacter(line, "{");
      const closes = countCharacter(line, "}");
      let enteredActiveRule = false;

      if (activeRuleDepth === 0) {
        selectorBuffer += ` ${line}`;
        if (opens > 0) {
          enteredActiveRule = selectorBuffer.includes(":active");
          activeRuleDepth = enteredActiveRule ? opens - closes : 0;
          selectorBuffer = "";
        }
      } else {
        activeRuleDepth += opens - closes;
      }

      if (
        (activeRuleDepth > 0 || enteredActiveRule) &&
        /(^|[;\s])transform\s*:\s*(?!none\b)[^;]+;/i.test(line)
      ) {
        matches.push({
          file: path.relative(process.cwd(), entryPath),
          line: index + 1,
          pattern: ":active transform",
          text: line.trim().slice(0, 160)
        });
      }

      if (activeRuleDepth < 0) {
        activeRuleDepth = 0;
      }
    });
  }

  return matches;
}

function countCharacter(value: string, character: string) {
  return [...value].filter((item) => item === character).length;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  await auditSourceForNativeDialogs();
  await auditSourceForActiveTransforms();
  await auditSourceForInlineStyles();
  await auditSourceForTypographyDrift();
  await auditSourceForColorDrift();
  await auditSourceForVisualEffectDrift();
  await auditSourceForHardcodedVisibleText();
  await auditSourceForI18nDictionaryShape();
  await auditSourceForI18nDefaultLocaleDrift();
  await auditSourceForPageRouteCoverage();
  const storageState = credentials ? await createAuthState(credentials) : undefined;
  const articleSlug =
    process.env.UI_AUDIT_ARTICLE_SLUG ?? (await discoverArticleSlug(storageState));
  const categorySlug =
    process.env.UI_AUDIT_CATEGORY_SLUG ?? (await discoverCategorySlug(storageState));

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
      await auditDesignTokens(page, "light", expectedLightTokens, browserName, viewport.name);
      await auditDesignTokens(page, "dark", expectedDarkTokens, browserName, viewport.name);
      await setAppearanceCookie(page, "light");
      for (const route of buildRoutes({
        articleSlug,
        categorySlug,
        includeAuthenticated: Boolean(storageState)
      })) {
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
        await auditPageDeleteDialog(page, browserName, viewport.name);
        await auditMediaDeleteDialog(page, browserName, viewport.name);
        await auditUserResetDialog(page, browserName, viewport.name);
      }
      if (viewport.width <= 560) {
        await auditMobileShell(page, browserName, viewport.name);
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
    "UI audit passed: no native browser dialogs, unexpected inline styles, typography source drift, color source drift, visual effect source drift, hardcoded visible text, i18n dictionary shape drift, default-locale i18n source drift, page route coverage gaps, unlocalized revision summaries, unlocalized authorization labels, unlocalized field/product terms, design token drift, page/control/text/article/media overflow, oversized article media, duplicate admin controls, stray dialogs, tiny or oversized controls, control or form-label typography mismatches, segmented-control mismatches, activity row overlaps, iconless command buttons, unnamed icon-only controls, button icon size/spacing or button size drift, modal mismatches, mobile shell drift, active-state source transforms, or active-state transform drift."
  );
}

function buildRoutes({
  articleSlug,
  categorySlug,
  includeAuthenticated
}: {
  articleSlug: string | undefined;
  categorySlug: string | undefined;
  includeAuthenticated: boolean;
}) {
  const routes = [...publicRoutes];
  if (articleSlug) {
    routes.push(
      `/page/${articleSlug}`,
      `/page/${articleSlug}/backlinks`,
      `/page/${articleSlug}/cite`,
      `/history/${articleSlug}`
    );
  }
  if (categorySlug) {
    routes.push(`/categories/${categorySlug}`);
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

async function discoverCategorySlug(storageState: AuditStorageState | undefined) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/categories`, {
      headers: cookieHeader(storageState)
    });
    if (!response.ok) {
      return undefined;
    }
    const body: unknown = await response.json();
    return extractFirstCategorySlug(body);
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

function extractFirstCategorySlug(body: unknown) {
  if (!isRecord(body)) {
    return undefined;
  }
  const data = body.data;
  if (!isRecord(data) || !Array.isArray(data.categories)) {
    return undefined;
  }
  const firstCategory = data.categories.find(isRecord);
  return typeof firstCategory?.slug === "string" ? firstCategory.slug : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function setAppearanceCookie(page: Page, theme: "light" | "dark") {
  await page.context().addCookies([
    {
      name: "noviqwiki-appearance",
      value: theme,
      url: baseUrl,
      sameSite: "Lax"
    }
  ]);
}

async function auditDesignTokens(
  page: Page,
  theme: "light" | "dark",
  expectedTokens: Record<string, string>,
  browserName: string,
  sizeName: string
) {
  await setAppearanceCookie(page, theme);
  const response = await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  if (!response || response.status() >= 500) {
    addFailure({
      kind: "design_token_navigation_error",
      browserName,
      sizeName,
      route: "/",
      detail: response?.status() ?? null
    });
    return;
  }

  const metrics = (await page.evaluate(`(() => {
    const style = getComputedStyle(document.documentElement);
    const tokens = {};
    for (const name of ${JSON.stringify(Object.keys(expectedTokens))}) {
      tokens[name] = style.getPropertyValue(name).trim();
    }
    return {
      theme: document.documentElement.dataset.theme,
      tokens,
      bodyFont: style.getPropertyValue("--nw-font-body").trim(),
      serifFont: style.getPropertyValue("--nw-font-serif").trim(),
      monoFont: style.getPropertyValue("--nw-font-mono").trim()
    };
  })()`)) as DesignTokenMetrics;

  const tokenMismatches = Object.entries(expectedTokens)
    .map(([name, expected]) => ({
      name,
      expected,
      actual: metrics.tokens[name]
    }))
    .filter(
      ({ expected, actual }) => normalizeTokenValue(actual) !== normalizeTokenValue(expected)
    );

  const fontExpectations: Array<[string, string, string[]]> = [
    ["--nw-font-body", metrics.bodyFont, ["Hanken Grotesk", "Noto Sans SC"]],
    ["--nw-font-serif", metrics.serifFont, ["Source Serif 4", "Noto Serif SC"]],
    ["--nw-font-mono", metrics.monoFont, ["JetBrains Mono"]]
  ];
  const fontMismatches = fontExpectations.filter(([, value, expectedFonts]) =>
    expectedFonts.some((font) => !value.includes(font))
  );

  if (metrics.theme !== theme || tokenMismatches.length > 0 || fontMismatches.length > 0) {
    addFailure({
      kind: "design_token_mismatch",
      browserName,
      sizeName,
      route: "/",
      detail: {
        expectedTheme: theme,
        theme: metrics.theme,
        tokenMismatches,
        fontMismatches
      }
    });
  }
}

function normalizeTokenValue(value: string | undefined) {
  const trimmed = (value ?? "").trim().toLowerCase();
  const shortHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(trimmed);
  if (shortHex) {
    return `#${shortHex[1]}${shortHex[1]}${shortHex[2]}${shortHex[2]}${shortHex[3]}${shortHex[3]}`;
  }
  const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(trimmed);
  if (rgb) {
    return `#${toHex(Number(rgb[1]))}${toHex(Number(rgb[2]))}${toHex(Number(rgb[3]))}`;
  }
  return trimmed.replace(/\s+/g, " ");
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
}

async function auditRoute(page: Page, route: string, browserName: string, sizeName: string) {
  const response = await page
    .goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 })
    .catch((error: unknown) => {
      if (
        error instanceof Error &&
        (error.message.includes("is interrupted by another navigation") ||
          error.message.includes("Timeout"))
      ) {
        return page
          .goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 45000 })
          .catch((retryError: unknown) => {
            addFailure({
              kind: "navigation_error",
              browserName,
              sizeName,
              route,
              detail: retryError instanceof Error ? retryError.message : String(retryError)
            });
            return null;
          });
      }
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
  await waitForDesignStyles(page);
  const metrics = await readRouteMetricsWithRetry(page, browserName, sizeName, route);
  if (!metrics) {
    return;
  }

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
  recordElementFailures(
    "oversized_form_controls",
    metrics.oversizedFormControls,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "control_typography_mismatch",
    metrics.controlTypographyMismatches,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "form_label_typography_mismatch",
    metrics.formLabelTypographyMismatches,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "oversized_filter_bars",
    metrics.oversizedFilterBars,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "segmented_control_mismatch",
    metrics.segmentedControlMismatches,
    browserName,
    sizeName,
    route
  );
  recordElementFailures("bad_file_inputs", metrics.badFileInputs, browserName, sizeName, route);
  recordElementFailures(
    "control_text_overflow",
    metrics.controlTextOverflow,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "text_content_overflow",
    metrics.textContentOverflow,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "article_container_overflow",
    metrics.articleContainerOverflow,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "article_media_overflow",
    metrics.articleMediaOverflow,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "article_media_too_tall",
    metrics.articleMediaTooTall,
    browserName,
    sizeName,
    route
  );
  recordElementFailures("stray_dialogs", metrics.visibleDialogs, browserName, sizeName, route);
  recordElementFailures(
    "command_buttons_without_icons",
    metrics.commandButtonsWithoutIcons,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "icon_only_controls_without_names",
    metrics.iconOnlyControlsWithoutNames,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "button_icon_size_mismatch",
    metrics.buttonIconSizeMismatches,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "button_icon_spacing_mismatch",
    metrics.buttonIconSpacingMismatches,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "command_button_size_mismatch",
    metrics.commandButtonSizeMismatches,
    browserName,
    sizeName,
    route
  );
  recordElementFailures("oversized_text", metrics.oversizedText, browserName, sizeName, route);
  recordElementFailures(
    "overlapping_activity_rows",
    metrics.overlappingActivityRows,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "duplicate_timeline_actions",
    metrics.duplicateTimelineActions,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "uneven_admin_page_actions",
    metrics.unevenAdminPageActions,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "uneven_history_actions",
    metrics.unevenHistoryActions,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "misaligned_history_rows",
    metrics.misalignedHistoryRows,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "stacked_history_current_badges",
    metrics.stackedHistoryCurrentBadges,
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
  if (metrics.rawAuditActions.length > 0) {
    addFailure({
      kind: "raw_audit_action_visible",
      browserName,
      sizeName,
      route,
      detail: metrics.rawAuditActions
    });
  }
  if (metrics.unlocalizedRevisionSummaries.length > 0) {
    addFailure({
      kind: "unlocalized_revision_summary",
      browserName,
      sizeName,
      route,
      detail: metrics.unlocalizedRevisionSummaries
    });
  }
  recordElementFailures(
    "unlocalized_authorization_labels",
    metrics.unlocalizedAuthorizationLabels,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "unlocalized_field_terms",
    metrics.unlocalizedFieldTerms,
    browserName,
    sizeName,
    route
  );
  recordElementFailures(
    "unlocalized_product_text",
    metrics.unlocalizedProductText,
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
  const diffLink = page.locator('a[href^="/diff/"]').first();
  if ((await diffLink.count()) === 0) {
    return undefined;
  }
  return diffLink.getAttribute("href");
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

async function readRouteMetricsWithRetry(
  page: Page,
  browserName: string,
  sizeName: string,
  route: string
): Promise<RouteMetrics | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await readRouteMetrics(page);
    } catch (error) {
      lastError = error;
      if (!isTransientNavigationError(error)) {
        break;
      }
      await page.waitForLoadState("domcontentloaded", { timeout: 4000 }).catch(() => null);
      await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => null);
      await waitForDesignStyles(page);
    }
  }

  addFailure({
    kind: "route_metrics_error",
    browserName,
    sizeName,
    route,
    detail: lastError instanceof Error ? lastError.message : String(lastError)
  });
  return null;
}

function isTransientNavigationError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.includes("Execution context was destroyed") ||
      error.message.includes("Cannot find context") ||
      error.message.includes("Target page, context or browser has been closed"))
  );
}

async function waitForDesignStyles(page: Page) {
  await page
    .waitForFunction(
      () => {
        const rootStyle = getComputedStyle(document.documentElement);
        return (
          rootStyle.getPropertyValue("--control-height").trim() === "34px" &&
          rootStyle.getPropertyValue("--nw-font-body").includes("Hanken Grotesk")
        );
      },
      null,
      { timeout: 4000 }
    )
    .catch(() => null);
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
    const visibleTextOf = (element) => {
      const collect = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent ?? "";
        }
        if (!(node instanceof Element)) {
          return "";
        }
        if (
          node.matches("svg, path, .sr-only") ||
          getComputedStyle(node).display === "none" ||
          getComputedStyle(node).visibility === "hidden"
        ) {
          return "";
        }
        return [...node.childNodes].map(collect).join(" ");
      };
      return collect(element).replace(/\\s+/g, " ").trim();
    };
    const summarize = (element) => ({
      tag: element.tagName,
      className: element.getAttribute("class") ?? "",
      label: labelOf(element).slice(0, 100),
      rect: rectOf(element)
    });
    const visibleMatches = (selector) =>
      [...document.querySelectorAll(selector)].filter(visible);
    const oversizedText = [
      ...visibleMatches(".activity-main strong, .timeline-title strong")
        .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) > 15.5),
      ...visibleMatches(".activity-meta, .timeline-meta")
        .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) > 13),
      ...visibleMatches(
        ".settings-card label:not(.checkbox-row), .homepage-section-toggles .checkbox-row span"
      ).filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) > 14.5),
      ...visibleMatches(".settings-card textarea").filter(
        (element) => Number.parseFloat(getComputedStyle(element).fontSize) > 14.5
      )
    ]
      .map(summarize)
      .slice(0, 12);
    const clientWidth = document.documentElement.clientWidth;
    const rawAuditTextNodes = [];
    const rawAuditWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (
          !parent ||
          !visible(parent) ||
          parent.closest(".permission-panel") ||
          parent.closest(".permission-checkbox") ||
          parent.closest(".role-card") ||
          parent.closest(".role-permission-checkboxes") ||
          parent.closest(".role-permission-summary")
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (rawAuditWalker.nextNode()) {
      rawAuditTextNodes.push(rawAuditWalker.currentNode.nodeValue || "");
    }
    const rawAuditActions = [
      ...new Set((rawAuditTextNodes.join("\\n").match(${rawAuditActionPattern}) || []).slice(0, 12))
    ];
    const unlocalizedRevisionSummaries =
      document.documentElement.lang.startsWith("zh") && location.pathname.startsWith("/history/")
        ? [
            ...document.querySelectorAll(
              ".history-summary-text, .history-compare-form option"
            )
          ]
            .map(labelOf)
            .filter((text) =>
              /\\b(?:Rollback(?: to revision| r)|Roll back to r|Initial publication|Initial publish|Update body)\\b/i.test(
                text
              )
            )
            .slice(0, 12)
        : [];
    const unlocalizedAuthorizationLabels =
      document.documentElement.lang.startsWith("zh") &&
      ["/admin/users", "/admin/groups", "/admin/roles"].includes(location.pathname)
        ? visibleMatches(
            [
              ".user-group-badges .badge",
              ".role-badge",
              ".group-card-name",
              ".group-role-badges .badge.success",
              ".role-card-header h2",
              ".permission-row.header .permission-cell-center"
            ].join(",")
          )
            .filter((element) =>
              /^(?:Owner|Administrator|Moderator|Editor|Contributor|Reader|owners|readers)$/.test(
                labelOf(element)
              )
            )
            .map(summarize)
            .slice(0, 12)
        : [];
    const unlocalizedFieldTerms = document.documentElement.lang.startsWith("zh")
      ? visibleMatches(
          [
            "label",
            "legend",
            "button",
            "a.button",
            "option",
            ".settings-kicker",
            ".confirm-dialog",
            ".notice",
            ".error",
            ".media-detail-label"
          ].join(",")
        )
          .filter((element) =>
            /\\b(?:Slug|slug|Logo URL|Favicon URL|Public URL|Media URL|Canonical URL)\\b/.test(
              labelOf(element)
            )
          )
          .map(summarize)
          .slice(0, 12)
      : [];
    const unlocalizedProductText = document.documentElement.lang.startsWith("zh")
      ? visibleMatches(
          [
            "button:not(.editor-tool-button):not(.icon-button)",
            "a.button",
            ".nav-list a",
            ".admin-tabs a",
            ".page-description",
            ".panel h2",
            ".admin-panel-heading",
            ".settings-kicker",
            ".settings-switch-title",
            ".settings-switch-help",
            "label:not(.checkbox-row)",
            "legend",
            "option",
            "input[placeholder]",
            "textarea[placeholder]",
            ".badge",
            ".audit-action",
            ".timeline-action",
            ".filter-pill",
            ".search-filter-link",
            ".admin-grid-header > div",
            ".media-detail-label",
            ".editor-preview-kicker",
            ".setup-step-title",
            ".setup-step-description"
          ].join(",")
        )
          .filter((element) => {
            const label = labelOf(element);
            if (/^[a-z]+(?:\\.[a-z_]+)+$/.test(label)) {
              return false;
            }
            return ${unlocalizedProductTextPattern}.test(label);
          })
          .map(summarize)
          .slice(0, 12)
      : [];

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
    const iconOnlyControlsWithoutNames = visibleMatches(
      "button, a.button, .icon-button, [role='button']"
    )
      .filter((element) => {
        if (
          element.closest(".cm-editor") ||
          element.closest(".media-grid") ||
          element.closest(".media-picker-grid")
        ) {
          return false;
        }
        if (!element.querySelector("svg, img")) {
          return false;
        }
        const visibleText = visibleTextOf(element);
        const text = (element.textContent ?? "").replace(/\\s+/g, " ").trim();
        const isIconOnly = !visibleText && (!text || Boolean(element.querySelector(".sr-only")));
        if (!isIconOnly) {
          return false;
        }
        const accessibleName =
          element.getAttribute("aria-label") ||
          element.getAttribute("title") ||
          element.querySelector(".sr-only")?.textContent ||
          "";
        return !accessibleName.trim();
      })
      .map(summarize)
      .slice(0, 12);
    const buttonIconSizeMismatches = visibleMatches("button svg, a.button svg, [role='button'] svg")
      .filter((icon) => {
        const control = icon.closest("button, a.button, [role='button']");
        if (
          !control ||
          control.closest(".media-grid") ||
          control.closest(".media-picker-grid") ||
          control.closest(".cm-editor")
        ) {
          return false;
        }
        const rect = icon.getBoundingClientRect();
        return rect.width < 12 || rect.height < 12 || rect.width > 24 || rect.height > 24;
      })
      .map((icon) => summarize(icon.closest("button, a.button, [role='button']") ?? icon))
      .slice(0, 12);
    const buttonIconSpacingMismatches = visibleMatches("button, a.button, [role='button']")
      .filter((element) => {
        if (
          element.closest(".segmented-control") ||
          element.closest(".setup-stepper") ||
          element.closest(".media-grid") ||
          element.closest(".media-picker-grid") ||
          element.closest(".cm-editor") ||
          element.classList.contains("editor-tool-button") ||
          element.classList.contains("icon-button")
        ) {
          return false;
        }
        const icons = [...element.querySelectorAll("svg")].filter(visible);
        if (icons.length === 0 || !visibleTextOf(element)) {
          return false;
        }
        const style = getComputedStyle(element);
        const gap = Number.parseFloat(style.columnGap || style.gap);
        return (
          !["flex", "inline-flex"].includes(style.display) ||
          style.flexDirection !== "row" ||
          style.alignItems !== "center" ||
          !Number.isFinite(gap) ||
          gap < 5 ||
          gap > 13
        );
      })
      .map(summarize)
      .slice(0, 12);
    const commandButtonSizeMismatches = visibleMatches("button, a.button, [role='button']")
      .filter((element) => {
        if (
          element.closest(".segmented-control") ||
          element.closest(".setup-stepper") ||
          element.closest(".home-hero-search") ||
          element.closest(".media-grid") ||
          element.closest(".media-picker-grid") ||
          element.closest(".cm-editor") ||
          element.closest(".search-filter-list") ||
          element.classList.contains("editor-tool-button")
        ) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        if (element.classList.contains("icon-button")) {
          return rect.width < 30 || rect.height < 30 || rect.width > 42 || rect.height > 42 || Math.abs(rect.width - rect.height) > 3;
        }
        if (element.matches(".compact, .button.compact, button.compact")) {
          return rect.height < 32 || rect.height > 36;
        }
        return rect.height < 32 || rect.height > 48;
      })
      .map(summarize)
      .slice(0, 12);

    const smallTargetSelectors = [
      "button",
      "a.button",
      ".nav-list a",
      ".admin-tabs a",
      ".aside-actions a",
      ".aside-action-form button",
      ".category-list a",
      ".search-filter-link",
      ".search-result",
      ".page-list-row",
      ".backlink-row",
      ".feature-card"
    ].join(",");
    const controlOverflowSelectors = [
      "button:not(.sr-only)",
      "a.button",
      ".nav-list a",
      ".admin-tabs a",
      ".article-tabs a",
      ".article-tabs button",
      ".filter-pill",
      ".search-filter-link",
      ".aside-actions a",
      ".aside-action-form button"
    ].join(",");
    const textOverflowSelectors = [
      ".activity-main",
      ".activity-main strong",
      ".activity-meta",
      ".timeline-title",
      ".timeline-title strong",
      ".timeline-meta",
      ".audit-action",
      ".timeline-action",
      ".badge",
      ".status-badge",
      ".role-badge",
      ".user-group-badges",
      ".admin-grid-row > *",
      ".admin-grid-row .mono",
      ".admin-grid-row .user-cell",
      ".admin-grid-row .user-cell strong",
      ".admin-grid-row .admin-action-list",
      ".history-revision-cell",
      ".history-revision-value",
      ".history-summary-cell",
      ".history-summary-text",
      ".history-summary-date",
      ".history-actions",
      ".page-list-row",
      ".search-result",
      ".category-list a",
      ".article-facts dd",
      ".settings-switch-title",
      ".settings-switch-help",
      ".media-filename",
      ".media-detail-name",
      ".media-reference-list li",
      ".group-card-name",
      ".group-role-badges",
      ".role-card-header h2",
      ".role-permission-summary",
      ".mono"
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
      oversizedFormControls: visibleMatches(
        ".admin-filter-control, .admin-filter-bar > button, .admin-filter-bar > .button, .editor-footer > button, .editor-footer > .button, .field, select"
      )
        .filter((element) => {
          if (element.tagName === "TEXTAREA" || element.matches("input[type='file']")) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          if (element.closest(".editor-footer")) {
            return rect.height > 44;
          }
          const compactFilter = Boolean(
            element.closest(".admin-filter-bar") ||
              element.classList.contains("admin-filter-control")
          );
          return compactFilter ? rect.height > 36 : rect.height > 44;
        })
        .map(summarize)
        .slice(0, 12),
      controlTypographyMismatches: visibleMatches("button, a.button, .field, textarea, select")
        .filter((element) => {
          if (
            element.closest(".cm-editor") ||
            element.closest(".media-grid") ||
            element.closest(".media-picker-grid")
          ) {
            return false;
          }
          const fontFamily = getComputedStyle(element).fontFamily;
          return !/Hanken Grotesk|Noto Sans SC/i.test(fontFamily);
        })
        .map(summarize)
        .slice(0, 12),
      formLabelTypographyMismatches: visibleMatches(
        [
          ".form label:not(.checkbox-row)",
          ".admin-form-grid label:not(.checkbox-row)",
          ".setup-fields label:not(.checkbox-row)",
          ".confirm-field-grid label:not(.checkbox-row)",
          ".settings-card label:not(.checkbox-row)",
          ".group-edit-form label:not(.checkbox-row)",
          ".role-edit-form label:not(.checkbox-row)",
          ".history-compare-form label:not(.checkbox-row)",
          ".media-picker-detail label",
          ".editor-footer span",
          ".user-group-form legend",
          ".group-edit-form legend",
          ".role-edit-form legend",
          ".settings-kicker",
          ".settings-switch-title",
          ".settings-switch-help",
          ".admin-status-label",
          ".system-label"
        ].join(",")
      )
        .filter((element) => {
          if (
            element.closest(".cm-editor") ||
            element.closest(".article-body") ||
            element.closest(".permission-panel") ||
            element.closest(".permission-checkbox") ||
            element.closest(".role-permission-checkboxes")
          ) {
            return false;
          }
          const label = labelOf(element);
          if (!label && !element.matches(".settings-kicker")) {
            return false;
          }
          const style = getComputedStyle(element);
          const fontSize = Number.parseFloat(style.fontSize);
          const lineHeight =
            style.lineHeight === "normal" ? fontSize * 1.25 : Number.parseFloat(style.lineHeight);
          const rowGap = Number.parseFloat(style.rowGap);
          const isHelpText = element.matches(
            ".settings-switch-help, .settings-kicker, legend, .system-label"
          );
          const maxFontSize = isHelpText ? 13.2 : 14.5;
          return (
            !/Hanken Grotesk|Noto Sans SC/i.test(style.fontFamily) ||
            fontSize > maxFontSize ||
            (Number.isFinite(lineHeight) && lineHeight > 21) ||
            (Number.isFinite(rowGap) && rowGap > 8)
          );
        })
        .map(summarize)
        .slice(0, 12),
      oversizedFilterBars: visibleMatches(".admin-filter-bar")
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          return rect.height > 66;
        })
        .map(summarize)
        .slice(0, 12),
      segmentedControlMismatches: visibleMatches(".segmented-control")
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const buttons = [...element.querySelectorAll("button")].filter(visible);
          if (buttons.length === 0) {
            return false;
          }
          const heights = buttons.map((button) => button.getBoundingClientRect().height);
          const tallest = Math.max(...heights);
          const shortest = Math.min(...heights);
          return rect.height > 42 || shortest < 30 || tallest > 36 || tallest - shortest > 2;
        })
        .map(summarize)
        .slice(0, 12),
      badFileInputs: visibleMatches("input[type='file']")
        .filter((element) => element.getBoundingClientRect().height < 40)
        .map(summarize)
        .slice(0, 12),
      controlTextOverflow: visibleMatches(controlOverflowSelectors)
        .filter((element) => {
          if (
            element.closest(".setup-stepper") ||
            element.closest(".home-hero-search") ||
            element.closest(".media-grid") ||
            element.closest(".media-picker-grid") ||
            element.closest(".cm-editor") ||
            element.classList.contains("editor-tool-button")
          ) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          const label = labelOf(element);
          if (!label) return false;
          const horizontalOverflow =
            element.scrollWidth > element.clientWidth + 2 ||
            [...element.children].some((child) => child.getBoundingClientRect().right > rect.right + 1);
          const wrappedCompactControl =
            rect.height > 46 &&
            (element.matches(".button, button, .filter-pill, .search-filter-link") ||
              element.closest(".admin-tabs") ||
              element.closest(".article-tabs"));
          return horizontalOverflow || wrappedCompactControl;
        })
        .map(summarize)
        .slice(0, 12),
      textContentOverflow: visibleMatches(textOverflowSelectors)
        .filter((element) => {
          if (
            element.closest(".cm-editor") ||
            element.closest(".editor-preview") ||
            element.closest(".article-body pre") ||
            element.closest(".media-code") ||
            element.closest(".permission-panel") ||
            element.closest(".permission-checkbox") ||
            element.closest(".role-permission-checkboxes")
          ) {
            return false;
          }
          const label = labelOf(element);
          if (!label || label.length < 2) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          if (style.overflowX === "auto" || style.overflowX === "scroll") {
            return false;
          }
          const contentWidth = element.clientWidth || rect.width;
          const scrollOverflow = element.scrollWidth > contentWidth + 2;
          const childOverflow = [...element.children]
            .filter(visible)
            .some((child) => {
              const childRect = child.getBoundingClientRect();
              return childRect.left < rect.left - 1 || childRect.right > rect.right + 1;
            });
          return scrollOverflow || childOverflow;
        })
        .map(summarize)
        .slice(0, 12),
      articleContainerOverflow: visibleMatches(
        ".article-page, .article-layout, .article, .article-body"
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const viewportWidth = document.documentElement.clientWidth;
          const isCompact = viewportWidth <= 560;
          const scrollOverflow = isCompact && element.scrollWidth > element.clientWidth + 2;
          const viewportOverflow = rect.left < -1 || rect.right > viewportWidth + 1;
          return scrollOverflow || viewportOverflow;
        })
        .map(summarize)
        .slice(0, 12),
      articleMediaOverflow: visibleMatches(
        ".article-body img, .article-body video, .article-body iframe, .article-body svg"
      )
        .filter((element) => {
          const articleBody = element.closest(".article-body");
          if (!articleBody) return false;
          const rect = element.getBoundingClientRect();
          const bodyRect = articleBody.getBoundingClientRect();
          return rect.left < bodyRect.left - 1 || rect.right > bodyRect.right + 1 || rect.width > bodyRect.width + 1;
        })
        .map(summarize)
        .slice(0, 12),
      articleMediaTooTall: visibleMatches(
        ".article-body img, .article-body video, .article-body iframe, .article-body svg"
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const isMobile = document.documentElement.clientWidth <= 560;
          const maxAllowedHeight = isMobile
            ? Math.min(window.innerHeight * 0.38, 260)
            : Math.min(window.innerHeight * 0.56, 460);
          return rect.height > maxAllowedHeight + 2;
        })
        .map(summarize)
        .slice(0, 12),
      visibleDialogs: visibleMatches("[role='dialog'], .modal-backdrop, [popover]")
        .map(summarize)
        .slice(0, 12),
      commandButtonsWithoutIcons,
      iconOnlyControlsWithoutNames,
      buttonIconSizeMismatches,
      buttonIconSpacingMismatches,
      commandButtonSizeMismatches,
      oversizedText,
      overlappingActivityRows: visibleMatches(".activity-row, .timeline-row:not(.timeline-footer)")
        .filter((element) => {
          const badge = element.querySelector(".audit-action, .timeline-action");
          const title = element.querySelector(".activity-main, .timeline-title");
          if (!badge || !title) return false;
          const badgeRect = badge.getBoundingClientRect();
          const titleRect = title.getBoundingClientRect();
          return badgeRect.right > titleRect.left - 2;
        })
        .map(summarize)
        .slice(0, 12),
      duplicateTimelineActions: visibleMatches(".timeline-row:not(.timeline-footer)")
        .filter((element) => {
          const badge = element.querySelector(".timeline-action");
          const title = element.querySelector(".timeline-title");
          return Boolean(
            badge &&
              title &&
              labelOf(badge) &&
              labelOf(title).trim() === labelOf(badge).trim()
          );
        })
        .map(summarize)
        .slice(0, 12),
      unevenAdminPageActions: visibleMatches(".admin-grid-row.admin-pages-grid .admin-action-list")
        .filter((element) => {
          if (document.documentElement.clientWidth > 560) return false;
          const actions = [...element.querySelectorAll(".button, button")].filter(visible);
          if (actions.length < 2) return false;
          const widths = actions.map((item) => item.getBoundingClientRect().width);
          return Math.max(...widths) - Math.min(...widths) > 4;
        })
        .map(summarize)
        .slice(0, 12),
      unevenHistoryActions: visibleMatches(".history-row .history-actions")
        .filter((element) => {
          if (document.documentElement.clientWidth > 560) return false;
          const actions = [...element.querySelectorAll(".button, button")].filter(visible);
          if (actions.length < 2) return false;
          const widths = actions.map((item) => item.getBoundingClientRect().width);
          return Math.max(...widths) - Math.min(...widths) > 4;
        })
        .map(summarize)
        .slice(0, 12),
      misalignedHistoryRows: visibleMatches(".history-row:not(.header)")
        .filter((element) => {
          if (document.documentElement.clientWidth > 560) return false;
          const summary = element.querySelector(".history-summary-text");
          const revision = element.querySelector(".history-revision-value");
          const actions = element.querySelector(".history-action-buttons");
          if (!summary || !revision || !actions) return false;
          const summaryX = summary.getBoundingClientRect().left;
          return [revision, actions].some(
            (item) => Math.abs(item.getBoundingClientRect().left - summaryX) > 4
          );
        })
        .map(summarize)
        .slice(0, 12),
      stackedHistoryCurrentBadges: visibleMatches(".history-revision-value")
        .filter((element) => {
          if (document.documentElement.clientWidth > 560) return false;
          const revision = element.querySelector(".history-revision-number");
          const badge = element.querySelector(".history-current-badge");
          if (!revision || !badge) return false;
          return Math.abs(revision.getBoundingClientRect().top - badge.getBoundingClientRect().top) > 4;
        })
        .map(summarize)
        .slice(0, 12),
      adminSettingsLinks: visibleMatches("a[href='/admin/settings']").map(summarize),
      adminTabsWithoutIcons: visibleMatches(".admin-tabs a")
        .filter((element) => !element.querySelector("svg"))
        .map(summarize),
      createAnchors: visibleMatches("a[href='#create-group'], a[href='#create-role']").map(
        summarize
      ),
      rawAuditActions,
      unlocalizedRevisionSummaries,
      unlocalizedAuthorizationLabels,
      unlocalizedFieldTerms,
      unlocalizedProductText
    };
  })()`) as Promise<RouteMetrics>;
}

async function auditActiveState(page: Page, browserName: string, sizeName: string) {
  const response = await page
    .goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" })
    .catch(() => page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" }).catch(() => null));
  if (!response) {
    addFailure({
      kind: "active_state_navigation_error",
      browserName,
      sizeName,
      route: "/"
    });
    return;
  }
  const targetHandle = await page.evaluateHandle(`(() => {
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
    return element;
  })()`);
  const targetElement = targetHandle.asElement() as ElementHandle<HTMLElement> | null;
  if (!targetElement) {
    await targetHandle.dispose();
    return;
  }
  const rect = await targetElement.boundingBox();
  if (!rect) {
    await targetHandle.dispose();
    return;
  }
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  let transform: string;
  try {
    await page.mouse.down();
    transform = await targetElement.evaluate((element) => getComputedStyle(element).transform);
  } catch (error) {
    if (
      error instanceof Error &&
      /Execution context was destroyed|Target closed|Frame was detached/.test(error.message)
    ) {
      return;
    }
    throw error;
  } finally {
    await page.mouse.move(0, 0).catch(() => undefined);
    await page.mouse.up().catch(() => undefined);
    await targetHandle.dispose().catch(() => undefined);
  }
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
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => null);
  const buttons = page.locator(".editor-toolbar .editor-tool-button");
  const count = await buttons.count();
  if (count === 0) {
    return;
  }
  await buttons.nth(count - 1).click();
  await waitForModal(page, ".media-picker-dialog[role='dialog']");
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
  const metrics = await readRouteMetricsWithRetry(
    page,
    browserName,
    sizeName,
    `/edit/${articleSlug}`
  );
  if (metrics) {
    recordElementFailures(
      "form_label_typography_mismatch",
      metrics.formLabelTypographyMismatches,
      browserName,
      sizeName,
      `/edit/${articleSlug}`
    );
  }
}

async function auditMobileShell(page: Page, browserName: string, sizeName: string) {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  const shell = (await page.evaluate(`(() => {
    const sidebar = document.querySelector(".sidebar");
    const rect = sidebar ? sidebar.getBoundingClientRect() : null;
    return {
      hasSidebar: Boolean(sidebar),
      sidebarHeight: rect?.height ?? 0,
      sidebarWidth: rect?.width ?? 0,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollWidth: document.body.scrollWidth
    };
  })()`)) as {
    hasSidebar: boolean;
    sidebarHeight: number;
    sidebarWidth: number;
    clientWidth: number;
    bodyScrollWidth: number;
  };

  if (
    !shell.hasSidebar ||
    shell.sidebarHeight > 96 ||
    shell.sidebarWidth > shell.clientWidth + 2 ||
    shell.bodyScrollWidth > shell.clientWidth + 2
  ) {
    addFailure({
      kind: "mobile_shell_mismatch",
      browserName,
      sizeName,
      route: "/",
      detail: shell
    });
  }
}

async function auditPageDeleteDialog(page: Page, browserName: string, sizeName: string) {
  await page.goto(`${baseUrl}/admin/pages`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => null);
  const opened = await openFirstDialogButton(
    page,
    'button[data-confirm-action="trash"]',
    ".confirm-dialog[role='dialog']"
  );
  if (!opened) {
    return;
  }
  const modal = await readModalMetrics(page, ".confirm-dialog[role='dialog']");
  if (
    !modal.hasBackdrop ||
    !modal.hasDialog ||
    modal.radius !== "14px" ||
    modal.overflow ||
    modal.warningTextAlign !== "left"
  ) {
    addFailure({
      kind: "page_delete_modal_mismatch",
      browserName,
      sizeName,
      route: "/admin/pages",
      detail: modal
    });
  }
}

async function auditMediaDeleteDialog(page: Page, browserName: string, sizeName: string) {
  await page.goto(`${baseUrl}/media`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => null);
  const opened = await openFirstDialogButton(
    page,
    ".media-delete-form button.danger",
    ".confirm-dialog[role='dialog']"
  );
  if (!opened) {
    return;
  }
  const modal = await readModalMetrics(page, ".confirm-dialog[role='dialog']");
  if (
    !modal.hasBackdrop ||
    !modal.hasDialog ||
    modal.radius !== "14px" ||
    modal.overflow ||
    modal.warningTextAlign !== "left"
  ) {
    addFailure({
      kind: "media_delete_modal_mismatch",
      browserName,
      sizeName,
      route: "/media",
      detail: modal
    });
  }
}

async function auditUserResetDialog(page: Page, browserName: string, sizeName: string) {
  await page.goto(`${baseUrl}/admin/users`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => null);
  const opened = await openFirstDialogButton(
    page,
    'button[data-confirm-action="reset"]',
    ".confirm-dialog[role='dialog']"
  );
  if (!opened) {
    return;
  }
  const modal = await readModalMetrics(page, ".confirm-dialog[role='dialog']");
  if (
    !modal.hasBackdrop ||
    !modal.hasDialog ||
    modal.radius !== "14px" ||
    modal.overflow ||
    modal.warningTextAlign !== "left"
  ) {
    addFailure({
      kind: "user_reset_modal_mismatch",
      browserName,
      sizeName,
      route: "/admin/users",
      detail: modal
    });
  }
}

async function openFirstDialogButton(page: Page, buttonSelector: string, dialogSelector: string) {
  const buttons = page.locator(buttonSelector);
  if ((await buttons.count()) === 0) {
    return false;
  }
  const button = buttons.first();
  await button.waitFor({ state: "visible", timeout: 4000 }).catch(() => null);
  await button.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => null);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await button.click({ timeout: 5000 });
    await page
      .locator(dialogSelector)
      .waitFor({ state: "visible", timeout: attempt === 0 ? 1200 : 4000 })
      .catch(() => null);
    if ((await page.locator(dialogSelector).count()) > 0) {
      return true;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function waitForModal(page: Page, dialogSelector: string) {
  await page
    .locator(dialogSelector)
    .waitFor({ state: "visible", timeout: 4000 })
    .catch(() => null);
}

async function readModalMetrics(page: Page, dialogSelector: string): Promise<ModalMetrics> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return (await page.evaluate(`(() => {
        const selector = ${JSON.stringify(dialogSelector)};
        const dialog = document.querySelector(selector);
        const backdrop = document.querySelector(".modal-backdrop");
        const warning = dialog?.querySelector(".confirm-warning");
        return {
          hasDialog: Boolean(dialog),
          hasBackdrop: Boolean(backdrop),
          radius: dialog ? getComputedStyle(dialog).borderRadius : null,
          overflow: document.body.scrollWidth > document.documentElement.clientWidth + 2,
          warningTextAlign: warning ? getComputedStyle(warning).textAlign : null
        };
      })()`)) as ModalMetrics;
    } catch (error) {
      if (!(
        error instanceof Error &&
        /Execution context was destroyed|Target closed|Frame was detached/.test(error.message)
      )) {
        throw error;
      }
      await page.waitForLoadState("domcontentloaded", { timeout: 4000 }).catch(() => null);
      await waitForModal(page, dialogSelector);
    }
  }
  return {
    hasDialog: false,
    hasBackdrop: false,
    radius: null,
    overflow: false,
    warningTextAlign: null
  };
}

void main();
