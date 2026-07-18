# NoviqWiki Testing

> [English](TESTING.md) | [简体中文](TESTING.md#简体中文)

NoviqWiki uses layered verification: formatting, linting, TypeScript checks, mostly PGlite-backed integration tests with selected real-PostgreSQL migration/concurrency cases, production builds, real-PostgreSQL Playwright tests, a non-reset live UI audit, and Docker Compose validation. Each layer proves a different scope.

Never report a command as passing unless it ran in the current checkout. A skipped prerequisite or partially authenticated UI audit must be reported as such.

## Command Reference

Use the smallest relevant set while developing:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Run the repository's required full suite before completion:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config --quiet
docker compose build
```

Use `docker compose config --quiet` for human verification. Plain `docker compose config` renders resolved environment values, including secrets, and must not be captured in logs or test evidence.

`pnpm format` writes changes. For a read-only release or CI check, use:

```bash
pnpm format:check
```

The live UI audit is separate because it expects an already running application:

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

Do not place a bare `pnpm test:ui` into an unattended full-suite batch unless a server is already available at its default `http://localhost:3100` and the intended authenticated variables are set.

## Test Environment Safety

- Unit tests and most integration tests do not need a running PostgreSQL service. Those integration tests create in-process PGlite databases and apply the SQL files from `drizzle/`. Supplying `NOVIQWIKI_TEST_POSTGRES_URL` enables PostgreSQL-specific migration and concurrency cases; use only a dedicated test database. The CI quality job supplies PostgreSQL 17.
- End-to-end tests use real PostgreSQL and destructively reset only a database whose name contains a separate `test`, `e2e`, or `ci` token.
- The UI audit does not reset its target database. It navigates a live site and opens supported dialogs without submitting destructive confirmations.
- Never point e2e, seed, restore, or manual cleanup commands at production or shared staging data.
- Operational scripts load `.env` by default through `dotenv/config`, not `.env.local`. Export test variables explicitly when the distinction matters.
- A smoke test that intentionally leaves an existing site without an active Owner exposes the unauthenticated Owner-only bootstrap, even when non-Owner accounts remain. Keep that target isolated from untrusted networks until the bootstrap is complete.

## Unit Tests

Run:

```bash
pnpm test
```

The script executes `vitest run tests/unit`. Current unit coverage includes small boundaries such as:

- Markdown rendering and sanitization.
- Wiki-link rewriting and HTML decoration.
- Title, route-parameter, redirect, revision, comparison, and citation helpers.
- Homepage and site-setting normalization.
- Plugin registry behavior.
- English and Simplified Chinese error, authorization-label, and revision-summary behavior.
- E2E disposable database-target safety helpers.
- Backup/restore target parsing, default-port normalization, ambient libpq/Compose override removal, password passfile handling, exact host/Compose confirmations, complete plain-SQL dumps, file-identity checks, dedicated canonical media paths, and unsafe tar member rejection.
- Session/CSRF cookie `Secure` selection from the `NOVIQWIKI_BASE_URL` `http:` or `https:` scheme, independently of `NODE_ENV`.
- Optional registration and Owner-setup display-name normalization, including blank values becoming absent.
- Repository branding enforcement that rejects the provisional identifier in any Git-tracked content.
- Compose fail-closed requirements for explicit database, canonical URL, and `NOVIQWIKI_SECRET` values, including explicit CI-only Docker settings.

Unit tests should remain deterministic and avoid a real network or production service. When a change introduces pure domain behavior, test edge cases and failure paths here before relying on a browser test.

## Integration Tests

Run:

```bash
pnpm test:integration
```

The script executes `vitest run tests/integration`. Most integration files create an in-process PGlite database and apply repository migration SQL through `tests/helpers/test-db.ts`. When `NOVIQWIKI_TEST_POSTGRES_URL` is set, the PostgreSQL-specific suite applies the migrations to that dedicated database and runs locking and concurrency cases. Without the variable, those cases are skipped; the PGlite portion does not require a standalone PostgreSQL server. The CI quality job starts PostgreSQL 17 and runs both portions.

Current integration coverage includes:

- Site setup, registration locale, email verification, password reset, and login after recovery.
- Setup-mode detection for no site, an existing site without an active Owner, and completed setup; Owner recovery preserves the existing site identity/default locale and non-Owner accounts, blocks public registration until an active Owner exists, and rejects a second bootstrap.
- Site visibility, groups, roles, permission assignment, built-in-role protection, and the final Owner invariant.
- Page creation, drafts, publishing, revisions, search indexing, categories, aliases, redirects, rename, archive, delete, restore, rollback, and page protection.
- Public page index, random page, wanted, orphaned, dead-end, short, protected, uncategorized, and redirect-maintenance queries.
- Watchlist, recent-change, and audit-log filtering/pagination.
- Media MIME allowlist behavior.
- Real-PostgreSQL registration-policy, authorization-snapshot, page-graph, search-index, and media-deletion concurrency behavior when `NOVIQWIKI_TEST_POSTGRES_URL` is supplied.

The PGlite cases exercise services and migration SQL, not the complete Next.js route-handler stack or PostgreSQL server behavior. The conditional PostgreSQL cases cover selected locking and concurrency risks, but do not prove every extension, query plan, connection mode, or production-volume behavior. Use the e2e suite and a representative PostgreSQL staging database for the remaining risks.

## End-to-End Tests

Install the configured browser when needed:

```bash
pnpm exec playwright install chromium
```

Run:

```bash
pnpm test:e2e
```

The wrapper performs these steps:

1. Selects a reset-safe real PostgreSQL URL.
2. Creates the database when possible, drops its `public` and `drizzle` schemas, recreates `public`, and applies migrations.
3. Uses `test-results/e2e-media` as the default local media root.
4. Validates an already prepared standalone artifact when the build is explicitly skipped; otherwise runs a production `next build` and copies static/public assets into the standalone output.
5. Starts the standalone output on port `3101` by default.
6. Runs the configured Chromium Playwright project.

The default database URL is:

```text
postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki_e2e
```

Override it when needed:

```bash
NOVIQWIKI_E2E_DATABASE_URL=postgres://user:pass@localhost:5432/noviqwiki_test pnpm test:e2e
```

The database name must contain a separate `test`, `e2e`, or `ci` token. If `NOVIQWIKI_E2E_DATABASE_URL` is unset and ambient `DATABASE_URL` already passes that rule, the wrapper uses it; otherwise it uses `noviqwiki_e2e`. It refuses ordinary names such as `noviqwiki` and refuses all resets when `NODE_ENV=production`.

Current Playwright coverage consists of two serial Chromium tests:

- Fresh setup creates the Owner; the Owner publishes and edits a page, compares revisions, rolls back, searches the restored content/category term, creates a linking page, and verifies backlinks.
- A login is performed when needed; an image is uploaded and searched, media copy controls and admin references are checked, an administrator creates a user, and the article is loaded at a mobile viewport.

Do not claim that the current e2e suite covers logout, login rate limiting, API status routes, group/role editing, viewer-denied paths, drafts, restricted-page leakage, or health/readiness merely because those are important product flows. Add explicit tests when a change needs those guarantees.

Useful overrides:

| Variable                     | Default                   | Purpose                                                      |
| ---------------------------- | ------------------------- | ------------------------------------------------------------ |
| `PLAYWRIGHT_PORT`            | `3101`                    | Standalone e2e server port.                                  |
| `PLAYWRIGHT_BASE_URL`        | `http://127.0.0.1:<port>` | Browser target URL.                                          |
| `NOVIQWIKI_E2E_MEDIA_ROOT`   | `test-results/e2e-media`  | E2E local media directory.                                   |
| `NOVIQWIKI_E2E_SKIP_BUILD`   | Unset                     | Set to `1` only with a compatible existing build.            |
| `NOVIQWIKI_E2E_REUSE_SERVER` | Unset                     | Set to `1` to reuse an existing server.                      |
| `NOVIQWIKI_E2E_SERVER_MODE`  | `start`                   | Set to `dev` only for an intentional development-server run. |

To reuse a local production build, prepare its standalone assets before setting the skip flag:

```bash
pnpm build
pnpm e2e:prepare
NOVIQWIKI_E2E_SKIP_BUILD=1 pnpm test:e2e
```

Create the disposable database manually if the configured PostgreSQL user cannot create databases. The wrapper resets the database schema but does not promise to delete arbitrary files from a custom e2e media path.

## UI Release Audit

`pnpm test:ui` is a non-reset audit of an already running review application. It launches Chromium and WebKit at these current viewports:

- Desktop: `1280x820`.
- Mobile: `439x734`.
- Narrow mobile: `390x844`.

Install both browsers when needed:

```bash
pnpm exec playwright install chromium webkit
```

For public-route coverage against a host development server:

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

For the complete authenticated audit:

```bash
UI_AUDIT_BASE_URL=http://localhost:3100 \
UI_AUDIT_USERNAME=owner \
UI_AUDIT_PASSWORD=replace-with-local-password \
UI_AUDIT_ARTICLE_SLUG=e2e-article \
pnpm test:ui
```

`UI_AUDIT_CATEGORY_SLUG` may also select a category; article and category slugs are auto-discovered when possible.

If `UI_AUDIT_USERNAME` and `UI_AUDIT_PASSWORD` are missing, authenticated editor/admin routes and related modal checks are skipped. If no suitable article or category is found, dependent checks are skipped. A zero-failure public-only run is not evidence for the skipped authenticated scope.

The audit currently checks broad release UI invariants, including:

- Public, authentication, recovery, article, history/diff, backlinks/citation, search, recent/watchlist, page-index, category, media, maintenance, editor, and admin route coverage.
- Light/dark design tokens, font families, headings, placeholders, labels, content rows, navigation, forms, cards, badges, filters, pagination, editor toolbar, permission matrix, summaries, citations, diffs, and article prose rhythm.
- Desktop/mobile containment, horizontal and child overflow, media sizing, control size, text wrapping, mobile shell/admin layouts, and WebKit form controls.
- Accessible names for icon-only controls and icon presence/spacing for visible command buttons.
- Confirmation, media-picker, rename, delete, rollback, and session-reset dialog presentation without submitting destructive confirmation actions.
- Duplicate or stray controls/dialogs, active-state movement, native `alert`/`confirm`/`prompt`/`beforeunload` use, source-level style drift, hard-coded visible text, i18n dictionary shape, and unlocalized system strings.

This is a visual/source invariant audit, not a full WCAG conformance test and not a substitute for the reset e2e workflow.

## Build Verification

Run:

```bash
pnpm build
```

This verifies the current Next.js production build, TypeScript/server-client boundaries encountered by the build, and standalone output generation. It does not replace `pnpm lint`, dedicated type checking, runtime database tests, or browser tests.

## Docker Verification

Validate the resolved Compose definition and build the image:

```bash
docker compose config --quiet
docker compose build
```

Use `--quiet` for this human gate. Plain `docker compose config` can print the resolved `NOVIQWIKI_SECRET`; `docker compose config --services` below is limited to service names.

Inspect the committed service names when needed:

```bash
docker compose config --services
```

Runtime debugging:

```bash
docker compose ps
docker compose logs --tail=200 app
```

`docker compose config --quiet` and `docker compose build` do not prove that the stack starts, migrations succeed, setup loads, persistent volumes work, or backup/restore succeeds. Record a separate clean-deployment smoke test when those properties are release requirements.

The committed stack requires explicit `POSTGRES_PASSWORD`, `DATABASE_URL`, `NOVIQWIKI_BASE_URL`, and `NOVIQWIKI_SECRET` values. It does not generate a fallback signing secret or mount a secrets volume. A relevant smoke test should verify that missing required values fail closed, PostgreSQL is private in `compose.yaml`, the application binds to loopback, and the opt-in `compose.dev.yaml` override exposes PostgreSQL only on loopback for host development.

## Current CI Scope

The tracked GitHub Actions workflows currently run:

- Formatting check, lint, typecheck, unit tests, integration tests, and build.
- The Chromium e2e suite against PostgreSQL.
- Docker Compose configuration and image build.

The quality job starts PostgreSQL 17, supplies `NOVIQWIKI_TEST_POSTGRES_URL`, and runs both the main PGlite integration coverage and the PostgreSQL-specific migration/concurrency cases. After its production build, it prepares the standalone output, archives it with symlinks intact, and retains the artifact for one day. The Playwright job downloads that exact build instead of compiling the application again. The Docker job uses the GitHub Actions BuildKit cache while still validating the committed Compose configuration and Dockerfile on every run.

They do not currently run the live `pnpm test:ui` audit, a clean `docker compose up` setup flow, `pnpm backup`, `pnpm restore`, or a restore drill. Those results must come from separately recorded execution rather than being inferred from green CI.

## Test Data

Tests should create deterministic records or use a documented disposable fixture. Useful coverage data includes:

- Owner, editor, viewer, suspended, and pending users where relevant.
- Public and restricted pages.
- Draft, published, archived, deleted, redirect, protected, and multiply revised pages.
- Markdown tables, code, math, unsafe HTML, wiki links, categories, and long bilingual text.
- Allowed, disallowed, oversized, referenced, and deleted media cases.

Never make automated tests depend on unrecorded manual edits in a developer's live database.

## Security Regression Coverage

Every privileged operation should have a denied-path test that checks both the response/error and the absence of data mutation. Prioritize:

- Cross-site or cross-resource identifiers.
- Restricted content reads and search leakage.
- Final Owner and built-in-role protection.
- Page-protection enforcement.
- Upload size, MIME detection, filename, and authorization.
- Session, CSRF, reset-token, verification-token, and login-rate-limit behavior.
- Sanitizer changes and stored HTML.

The repository has meaningful service-level authorization and sanitizer coverage, but not every item above is currently exercised end to end. Describe actual evidence precisely.

## Reporting Results

For every reported gate, include:

- Exact command and relevant non-secret environment overrides.
- Pass, fail, skipped, or not-run status.
- Checkout commit and material environment details.
- Relevant failure output or artifact location.
- Scope skipped because of missing credentials, fixtures, database, Docker, or browsers.

Example:

```text
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui passed for public routes; authenticated routes were skipped because UI_AUDIT_USERNAME and UI_AUDIT_PASSWORD were not set.
```

---

## 简体中文

> [English](TESTING.md) | [简体中文](TESTING.md#简体中文)

NoviqWiki 采用分层验证：格式化、代码检查、TypeScript 检查、单元测试、主要基于 PGlite 且包含部分真实 PostgreSQL 迁移/并发用例的集成测试、生产构建、真实 PostgreSQL Playwright 测试、非重置在线 UI 审计，以及 Docker Compose 验证。每一层证明的范围不同。

只有在当前检出中实际运行过的命令才能报告为通过。缺少前置条件或只完成部分已登录 UI 审计时，必须明确报告跳过范围。

### 命令参考

开发时使用最小相关集合：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

完成前运行仓库要求的完整套件：

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config --quiet
docker compose build
```

人类验证应使用 `docker compose config --quiet`。普通 `docker compose config` 会渲染解析后的环境变量值，包括密钥，不得把其输出保存到日志或测试证据中。

`pnpm format` 会写入变更。只读发布或 CI 检查使用：

```bash
pnpm format:check
```

在线 UI 审计要求应用已经运行，因此单独执行：

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

除非服务器已经在默认的 `http://localhost:3100` 可用，且设置了计划使用的已登录变量，否则不要把裸 `pnpm test:ui` 放进无人值守的完整批处理。

### 测试环境安全

- 单元测试和大多数集成测试不需要运行中的 PostgreSQL 服务。这些集成测试会创建进程内 PGlite 数据库并应用 `drizzle/` 中的 SQL 文件。设置 `NOVIQWIKI_TEST_POSTGRES_URL` 后会启用 PostgreSQL 专属的迁移与并发用例；只能使用专用测试数据库。CI 质量作业会提供 PostgreSQL 17。
- 端到端测试使用真实 PostgreSQL，只会破坏性重置数据库名中包含独立 `test`、`e2e` 或 `ci` 标记的数据库。
- UI 审计不会重置目标数据库。它浏览在线站点并打开支持的对话框，但不会提交破坏性确认。
- 绝不能把 e2e、种子、恢复或手动清理命令指向生产或共享预发布数据。
- 运维脚本通过 `dotenv/config` 默认加载 `.env`，不是 `.env.local`。有区别时应显式导出测试变量。
- 若冒烟测试故意让现有站点处于没有 active Owner 的状态，即使仍有非 Owner 账号，也会暴露未经身份验证的仅限 Owner 引导流程。在引导完成前，必须让该目标与不受信任网络隔离。

### 单元测试

运行：

```bash
pnpm test
```

该脚本执行 `vitest run tests/unit`。当前单元覆盖包括：

- Markdown 渲染和清理。
- Wiki 链接改写和 HTML 装饰。
- 标题、路由参数、重定向、修订、比较和引用辅助函数。
- 首页和站点设置规范化。
- 插件注册表行为。
- 英文和简体中文错误、授权标签及修订摘要行为。
- E2E 一次性数据库目标安全辅助函数。
- 备份/恢复目标解析、默认端口规范化、环境中 libpq/Compose 覆盖的移除、密码 passfile 处理、准确的主机/Compose 确认、完整纯 SQL 转储、文件身份检查、专用规范媒体路径以及不安全 tar 成员拒绝逻辑。
- 根据 `NOVIQWIKI_BASE_URL` 的 `http:` 或 `https:` 协议选择会话/CSRF Cookie 的 `Secure` 属性，且不依赖 `NODE_ENV`。
- 可选注册与 Owner 设置显示名称的规范化，包括把空白值视为未提供。
- 仓库品牌标识约束：任何 Git 跟踪内容重新引入临时标识都会失败。
- Compose 对显式数据库、规范 URL 和 `NOVIQWIKI_SECRET` 值的失败关闭要求，以及显式的 CI 专用 Docker 配置。

单元测试应保持确定性，不依赖真实网络或生产服务。变更新增纯领域行为时，应先在此覆盖边界情况和失败路径，而不是只依赖浏览器测试。

### 集成测试

运行：

```bash
pnpm test:integration
```

该脚本执行 `vitest run tests/integration`。大多数集成文件会创建进程内 PGlite 数据库，并通过 `tests/helpers/test-db.ts` 应用仓库迁移 SQL。设置 `NOVIQWIKI_TEST_POSTGRES_URL` 后，PostgreSQL 专属套件会把迁移应用到该专用数据库，并运行锁与并发用例。未设置该变量时会跳过这些用例；PGlite 部分不要求独立 PostgreSQL 服务器。CI 质量作业会启动 PostgreSQL 17 并运行两个部分。

当前集成覆盖包括：

- 站点设置、注册语言、邮箱验证、密码重置以及恢复后的登录。
- 无站点、现有站点没有 active Owner 和已完成设置三种模式的检测；Owner 恢复会保留现有站点标识、默认语言和非 Owner 账号，在 active Owner 创建前阻断公开注册，并拒绝第二次引导。
- 站点可见性、组、角色、权限分配、内置角色保护和最后一个所有者不变量。
- 页面创建、草稿、发布、修订、搜索索引、分类、别名、重定向、重命名、归档、删除、恢复、回滚和页面保护。
- 公共页面索引、随机页面、需要页面、孤立页面、无出链页面、短页面、受保护页面、未分类页面和重定向维护查询。
- 关注列表、最近更改和审计日志筛选与分页。
- 媒体 MIME 允许列表行为。
- 设置 `NOVIQWIKI_TEST_POSTGRES_URL` 后，验证真实 PostgreSQL 上的注册策略、授权快照、页面图、搜索索引和媒体删除并发行为。

PGlite 用例验证服务和迁移 SQL，不覆盖完整 Next.js 路由处理栈或 PostgreSQL 服务器行为。条件式 PostgreSQL 用例覆盖部分锁与并发风险，但不能证明所有扩展、查询计划、连接模式或生产数据量行为。其余风险应使用 e2e 套件和有代表性的 PostgreSQL 预发布数据库验证。

### 端到端测试

需要时安装配置的浏览器：

```bash
pnpm exec playwright install chromium
```

运行：

```bash
pnpm test:e2e
```

包装脚本执行以下步骤：

1. 选择可安全重置的真实 PostgreSQL URL。
2. 尽可能创建数据库，删除其 `public` 和 `drizzle` 架构，重新创建 `public` 并应用迁移。
3. 默认使用 `test-results/e2e-media` 作为本地媒体根目录。
4. 明确跳过构建时验证已经准备好的独立产物；否则执行生产 `next build`，并把静态和公共资源复制到独立输出。
5. 默认在 `3101` 端口启动独立输出。
6. 运行配置的 Chromium Playwright 项目。

默认数据库 URL：

```text
postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki_e2e
```

需要时覆盖：

```bash
NOVIQWIKI_E2E_DATABASE_URL=postgres://user:pass@localhost:5432/noviqwiki_test pnpm test:e2e
```

数据库名必须包含独立的 `test`、`e2e` 或 `ci` 标记。如果未设置 `NOVIQWIKI_E2E_DATABASE_URL`，但现有 `DATABASE_URL` 已满足该规则，包装脚本会使用它；否则使用 `noviqwiki_e2e`。它拒绝 `noviqwiki` 等普通名称，并在 `NODE_ENV=production` 时拒绝所有重置。

当前 Playwright 覆盖由两个串行 Chromium 测试组成：

- 全新设置创建所有者；所有者发布并编辑页面、比较修订、回滚、搜索恢复内容和分类词、创建链接来源页并验证反向链接。
- 需要时执行登录；上传并搜索图片，检查媒体复制控件和管理引用，管理员创建用户，并在移动视口加载文章。

不要因为退出、登录限流、API 状态路由、组与角色编辑、查看者拒绝路径、草稿、受限页面泄漏或健康与就绪是重要流程，就宣称当前 e2e 已覆盖它们。变更需要这些保证时必须添加明确测试。

常用覆盖变量：

| 变量                         | 默认值                    | 用途                                       |
| ---------------------------- | ------------------------- | ------------------------------------------ |
| `PLAYWRIGHT_PORT`            | `3101`                    | 独立 e2e 服务器端口。                      |
| `PLAYWRIGHT_BASE_URL`        | `http://127.0.0.1:<port>` | 浏览器目标 URL。                           |
| `NOVIQWIKI_E2E_MEDIA_ROOT`   | `test-results/e2e-media`  | E2E 本地媒体目录。                         |
| `NOVIQWIKI_E2E_SKIP_BUILD`   | 未设置                    | 仅在已有兼容构建时设置为 `1`。             |
| `NOVIQWIKI_E2E_REUSE_SERVER` | 未设置                    | 设置为 `1` 复用现有服务器。                |
| `NOVIQWIKI_E2E_SERVER_MODE`  | `start`                   | 仅在明确进行开发服务器运行时设置为 `dev`。 |

若要复用本地生产构建，应先准备其独立资源，再设置跳过标志：

```bash
pnpm build
pnpm e2e:prepare
NOVIQWIKI_E2E_SKIP_BUILD=1 pnpm test:e2e
```

若配置的 PostgreSQL 用户无法创建数据库，请手动创建可丢弃数据库。包装脚本会重置数据库架构，但不保证删除自定义 e2e 媒体路径中的任意文件。

### UI 发布审计

`pnpm test:ui` 对已经运行的检查应用执行非重置审计。它在 Chromium 和 WebKit 中使用以下当前视口：

- 桌面：`1280x820`。
- 移动：`439x734`。
- 窄屏移动：`390x844`。

需要时安装两个浏览器：

```bash
pnpm exec playwright install chromium webkit
```

对主机开发服务器执行公共路由覆盖：

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

完整已登录审计：

```bash
UI_AUDIT_BASE_URL=http://localhost:3100 \
UI_AUDIT_USERNAME=owner \
UI_AUDIT_PASSWORD=replace-with-local-password \
UI_AUDIT_ARTICLE_SLUG=e2e-article \
pnpm test:ui
```

也可通过 `UI_AUDIT_CATEGORY_SLUG` 指定分类；脚本会尽可能自动发现文章和分类 slug。

如果缺少 `UI_AUDIT_USERNAME` 和 `UI_AUDIT_PASSWORD`，已登录编辑器、管理路由及相关模态框检查会被跳过。如果找不到合适文章或分类，依赖它们的检查也会跳过。公共检查零失败不能作为被跳过已登录范围的证据。

当前审计覆盖广泛的发布 UI 不变量，包括：

- 公共、身份验证、恢复、文章、历史与差异、反向链接与引用、搜索、最近更改与关注、页面索引、分类、媒体、维护、编辑器和管理路由覆盖。
- 明暗设计令牌、字体、标题、占位符、标签、内容行、导航、表单、卡片、徽章、筛选、分页、编辑器工具栏、权限矩阵、摘要、引用、差异和文章排版节奏。
- 桌面与移动容纳、水平和子元素溢出、媒体大小、控件大小、文本换行、移动外壳与管理布局以及 WebKit 表单控件。
- 纯图标控件的可访问名称，以及可见命令按钮的图标存在和间距。
- 确认、媒体选择、重命名、删除、回滚和会话重置对话框样式，但不提交破坏性确认操作。
- 重复或游离控件与对话框、活动状态移动、原生 `alert`/`confirm`/`prompt`/`beforeunload`、源码样式漂移、硬编码可见文本、i18n 字典结构和未本地化系统字符串。

这是视觉和源码不变量审计，不是完整 WCAG 合规测试，也不能替代重置式 e2e 流程。

### 构建验证

运行：

```bash
pnpm build
```

该命令验证当前 Next.js 生产构建、构建遇到的 TypeScript 与服务器/客户端边界，以及独立输出生成。它不能替代 `pnpm lint`、独立类型检查、运行时数据库测试或浏览器测试。

### Docker 验证

验证解析后的 Compose 定义并构建镜像：

```bash
docker compose config --quiet
docker compose build
```

此人类门禁应使用 `--quiet`。普通 `docker compose config` 可能输出解析后的 `NOVIQWIKI_SECRET`；下方的 `docker compose config --services` 只输出服务名。

需要时检查提交的服务名：

```bash
docker compose config --services
```

运行时调试：

```bash
docker compose ps
docker compose logs --tail=200 app
```

`docker compose config --quiet` 和 `docker compose build` 不能证明栈能够启动、迁移成功、设置页加载、持久卷工作或备份恢复成功。如果这些属性属于发布要求，应单独记录干净部署冒烟测试。

提交的栈要求显式设置 `POSTGRES_PASSWORD`、`DATABASE_URL`、`NOVIQWIKI_BASE_URL` 和 `NOVIQWIKI_SECRET`。它不会生成回退签名密钥或挂载密钥卷。相关冒烟测试应验证缺少必填值时会失败关闭、`compose.yaml` 保持 PostgreSQL 私有、应用绑定到回环地址，以及显式启用的 `compose.dev.yaml` 覆盖只在回环地址暴露 PostgreSQL 供主机开发使用。

### 当前 CI 范围

跟踪的 GitHub Actions 工作流当前运行：

- 格式检查、lint、类型检查、单元测试、集成测试和构建。
- 针对 PostgreSQL 的 Chromium e2e 套件。
- Docker Compose 配置和镜像构建。

质量作业会启动 PostgreSQL 17，提供 `NOVIQWIKI_TEST_POSTGRES_URL`，并同时运行主要 PGlite 集成覆盖及 PostgreSQL 专属的迁移/并发用例。生产构建完成后，它会准备独立输出、保留其中的符号链接并打包，产物保留一天。Playwright 作业下载同一份构建，不再重新编译应用。Docker 作业使用 GitHub Actions BuildKit 缓存，同时仍在每次运行中验证提交的 Compose 配置和 Dockerfile。

当前 CI 不运行在线 `pnpm test:ui`、干净 `docker compose up` 设置流程、`pnpm backup`、`pnpm restore` 或恢复演练。这些结果必须来自单独记录的实际执行，不能从绿色 CI 推断。

### 测试数据

测试应创建确定性记录或使用有文档的可丢弃夹具。有效覆盖数据包括：

- 与场景相关的所有者、编辑者、查看者、已暂停和待验证用户。
- 公共和受限页面。
- 草稿、已发布、已归档、已删除、重定向、受保护和多修订页面。
- Markdown 表格、代码、数学、危险 HTML、Wiki 链接、分类和长双语文本。
- 允许、不允许、超限、被引用和已删除媒体场景。

自动化测试不得依赖开发者在线数据库中未记录的手动编辑。

### 安全回归覆盖

每个特权操作都应有拒绝路径测试，同时检查响应或错误以及没有发生数据变更。优先覆盖：

- 跨站点或跨资源标识。
- 受限内容读取和搜索泄漏。
- 最后一个所有者和内置角色保护。
- 页面保护执行。
- 上传大小、MIME 检测、文件名和授权。
- 会话、CSRF、重置令牌、验证令牌和登录限流。
- 清理器变更和已存储 HTML。

仓库已有重要的服务级授权和清理覆盖，但以上并非每一项都有完整端到端测试。应准确描述实际证据。

### 报告结果

每项门禁报告应包括：

- 准确命令及相关的非敏感环境覆盖。
- 通过、失败、跳过或未运行状态。
- 检出提交和重要环境信息。
- 相关失败输出或制品位置。
- 因缺少凭据、夹具、数据库、Docker 或浏览器而跳过的范围。

示例：

```text
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui passed for public routes; authenticated routes were skipped because UI_AUDIT_USERNAME and UI_AUDIT_PASSWORD were not set.
```
