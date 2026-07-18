# NoviqWiki Architecture

> [English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.md#简体中文)

NoviqWiki is a TypeScript/Next.js App Router modular monolith backed by PostgreSQL and Drizzle ORM. The baseline deployment is one application process, one PostgreSQL database, and persistent media storage.

## Runtime Topology

```text
Browser or API client
        |
        v
Next.js application
  - React Server Components and server actions
  - /api/v1 JSON route handlers
  - /api/health and /api/ready
        |
        +-------------------+
        v                   v
   PostgreSQL        local filesystem or S3-compatible storage
```

- Next.js serves public wiki pages, authenticated editing/workspace pages, administration pages, direct local-media reads, and JSON routes.
- PostgreSQL stores the primary site and settings, identities and sessions, RBAC, content state, immutable revisions, per-user drafts, current link/category/search projections, watchlists, media metadata, audit events, and rate-limit events.
- Local media bytes live in `NEXTWIKI_MEDIA_ROOT`; S3-compatible media bytes live in the configured bucket.
- `compose.yaml` runs the application and PostgreSQL, with named volumes for the database, local media, and backups.
- The runtime currently loads one primary site through `getPrimarySiteWithSettings`. Many tables carry `siteId` for isolation and future multi-site work, but v0.1.0 is operated as a single-site application.

## Request and Mutation Flow

The intended boundary is:

```text
route/page/server action -> parse input and establish actor -> domain service -> Drizzle/PostgreSQL or storage
```

- JSON mutation handlers in `src/app/api/v1/**/route.ts` parse their request bodies with Zod and call services in `src/modules/**`.
- Server actions in `src/app/actions.ts` establish the current session where required, extract form values, and delegate to domain services. Most privileged branches check permissions before delegation; every new branch must do so explicitly.
- Read-only React Server Components call services to obtain domain data.
- Global permission checks are currently concentrated at route/server-action boundaries. Page services independently enforce the extra `page.protect` requirement for protected-page mutations, but most services do not repeat every global permission check. Internal callers must not bypass an authorized boundary.
- Input validation is not yet uniform: many form actions use typed extraction helpers, and most query strings/route parameters are not Zod-parsed. New boundaries should validate all untrusted input before calling a service.

Known boundary exceptions: `src/app/admin/status/page.tsx` runs a database readiness query directly from a Server Component, and `src/app/admin/page.tsx` directly queries database tables for dashboard counts. These reads should move behind operational/admin services if the “components do not query the database” rule is to remain absolute.

## Source Layout and Responsibilities

- `src/app/**`: App Router pages, layouts, route handlers, and server actions. Keep orchestration here; do not add reusable domain rules here.
- `src/components/**`: reusable UI and editor components. Components should receive data or call approved server boundaries, not import database tables.
- `src/modules/pages/**`: page lifecycle, drafts, publication, revisions, links, maintenance reports, citations, protection, and current content projections.
- `src/modules/rendering/**`: Markdown, GFM, math, syntax highlighting, sanitization, headings, wiki links, and plain-text derivation.
- `src/modules/redirects/**`: content redirect parsing, resolution, loop/depth checks, and redirect reports.
- `src/modules/auth/**`, `src/modules/authorization/**`, and `src/modules/users/**`: credentials, sessions, recovery, rate limits, groups, roles, permissions, and user lifecycle.
- `src/modules/search/**`, `src/modules/categories/**`, `src/modules/activity/**`, and `src/modules/watchlist/**`: read models for discovery and user activity.
- `src/modules/media/**`: upload checks, metadata, reference discovery, and local/S3 storage adapters.
- `src/modules/settings/**`, `src/modules/setup/**`, and `src/modules/audit/**`: installation, site settings, homepage configuration, and audit events.
- `src/modules/plugins/**`: a small in-process registry; see “Extension boundary” below.
- `src/db/**`: Drizzle client, schema, and primary-site query helpers.
- `drizzle/**`: committed SQL migrations and Drizzle migration metadata.
- `scripts/**`: migration, seed, search reindex, backup, restore, disposable E2E setup, UI audit, and OpenAPI generation commands.
- `src/i18n/**`: English and Simplified Chinese message contracts plus locale-specific formatting helpers.

## Persistence Model

### Site, identity, and authorization

- `sites` and `site_settings` hold the primary site and configurable behavior.
- `users` stores normalized identity fields and Argon2id password hashes.
- `sessions` stores HMAC-derived session and CSRF hashes, expiry, revocation, user agent, and hashed client IP metadata.
- `groups`, `roles`, `permissions`, `user_groups`, `group_roles`, and `role_permissions` implement group-mediated RBAC. Users do not have a direct user-to-role relation.
- Verification and password-reset token tables store HMAC-derived token values with expiry and consumption timestamps.

### Content

- `pages` stores current identity and lifecycle state: title, normalized title, slug, current revision, status, protection, deletion, and archive metadata.
- `page_drafts` stores one mutable draft per page/editor pair. Saving a draft updates that record and does not create a revision.
- `page_revisions` stores immutable published snapshots: source Markdown, sanitized HTML, plain text, hash, revision lineage/number, editor attribution, edit summary, headings, categories, and outbound target titles.
- `page_aliases` maps old or alternate slugs to a current page. Content-authored redirects remain Markdown directives in revisions rather than rows in a separate redirect table.
- `page_categories`, `page_links`, and `search_index` are replaceable projections of the current published revision. They are not the canonical history.
- `page_watchlist` records per-user watched pages.

### Media and operations

- `media_assets` stores metadata and a storage key; the object bytes remain in the selected storage backend.
- `audit_logs` stores structured action events. `requestId`, `ipHash`, and `userAgent` columns exist, but current domain write sites generally do not populate request metadata.
- `rate_limit_events` currently supports login attempt limiting.

## Publication Transaction

Markdown is canonical. A successful publication or rollback performs the following work in a database transaction:

1. Load the page and reject deleted state, protected writes without `page.protect`, and detectable redirect loops. Ordinary publication also rejects a stale base revision; rollback verifies that the target revision belongs to the page.
2. Render the Markdown into sanitized HTML, readable plain text, headings, category declarations, and wiki-link targets.
3. Insert a new immutable `page_revisions` row.
4. Point `pages.currentRevisionId` at the new revision and set the page to `published`.
5. For ordinary publication, remove the publishing editor's mutable draft. Rollback leaves existing drafts untouched.
6. Replace current category and link projections.
7. Upsert the PostgreSQL search projection.
8. Write the relevant audit event.

Draft saving is intentionally different: it upserts `page_drafts` and writes an audit event without rendering or creating an immutable revision.

## Rendering and Search

The renderer is a Unified pipeline:

```text
Markdown
 -> wiki-link preprocessing
 -> remark-parse + remark-gfm + remark-math
 -> remark-rehype (raw HTML disabled)
 -> heading IDs + KaTeX + syntax highlighting
 -> rehype-sanitize
 -> stored HTML and derived plain text
```

Published pages update a dedicated `search_index` table. PostgreSQL uses a generated `tsvector` with the `simple` configuration, weighted title/alias/category/body fields, prefix queries, and case-insensitive substring fallbacks. `src/modules/search/service.ts` is the UI-facing service boundary, but it currently contains PostgreSQL/Drizzle queries directly; there is no implemented `SearchAdapter` interface or OpenSearch adapter.

## Authentication and Authorization

- Local username/email credentials are hashed with Argon2id.
- Successful login creates a 14-day database session and sets `noviqwiki_session` (`HttpOnly`) plus `noviqwiki_csrf` (readable by the browser), both `SameSite=Lax` and `Secure` in production.
- Permission evaluation unions the permissions of every role assigned to every group containing the user.
- Anonymous users receive only `site.view`, `page.read`, `revision.read`, and `media.read`, and only while `publicMode` is enabled.
- Built-in Administrator and Owner roles currently receive every permission key. Owner is additionally protected by the final-active-Owner invariant.
- `/admin/**` has an outer `site.configure` layout gate. Narrow permissions such as `audit.read` may authorize JSON routes but do not independently grant access to the corresponding admin page.

See `docs/AUTHORIZATION.md` for the exact role grants, protected-page rules, and current enforcement gaps.

## Media Architecture

`StorageAdapter` defines `put`, `delete`, `getPublicUrl`, and `isReady`.

- `LocalStorageAdapter` uses randomized storage keys below `NEXTWIKI_MEDIA_ROOT`, rejects traversal outside that root, and serves bytes through `/media/[...key]` after `media.read` authorization. The current local response is marked `public, max-age=31536000, immutable`. Private deployments must disable shared proxy/CDN caching. Deployments that require immediate revocation after logout, permission removal, a private-mode change, or deletion must change the route to `Cache-Control: private, no-store` and purge already cached objects or rotate previously distributed URLs.
- `S3StorageAdapter` uses an S3-compatible endpoint and redirects authorized `/media/[...key]` reads to a short-lived signed URL. A signed URL returned during upload is not a durable content identifier; page content should use the same-origin media route and storage key.
- Runtime adapter selection uses `NEXTWIKI_MEDIA_DRIVER`. The `site_settings.media_driver` value collected during setup is persisted but is not consulted by `getStorageAdapter`; deployments must configure the environment variable consistently.
- Local readiness creates/checks the media directory. S3 readiness currently checks only that a bucket name exists and does not contact S3.
- Upload validation enforces size and an allowlist. When byte detection fails, it currently falls back to the client-declared MIME type; this is a known hardening gap, not full content verification.

## Internationalization

The message contract lives in `src/i18n/en.ts`; `src/i18n/zh-CN.ts` must have the same shape. Product UI supports `en` and `zh-CN`.

Most request-specific messages use this precedence through `getRequestLocale`:

1. `noviqwiki-locale` cookie.
2. Active user's stored locale.
3. `Accept-Language` containing Chinese.
4. The supplied site default, then English.

The root layout currently uses cookie, active user, then site default and does not consult `Accept-Language`. Keep both resolution paths aligned when changing locale behavior. Stored user-authored titles, Markdown, custom role/group names, and edit summaries are not translated.

## Site Customization

`site_settings` stores logo/favicon URLs, tagline/footer copy, SEO metadata, homepage copy, layout mode, section visibility, and featured page/category slugs. The homepage loads configured published features first and falls back to recent published content when no configured page resolves. Rendering remains server-side.

## Extension Boundary

`src/modules/plugins/registry.ts` is an in-memory registry with plugin metadata and optional homepage contributions. The homepage reads registered contributions, and unit tests cover registry behavior. v0.1.0 does not discover packages, load plugins from configuration, sandbox code, expose a marketplace, or persist registrations. Treat it as an internal extension seam, not a user-installable plugin system.

## Deployment and Operations

- The production image builds a Next.js standalone bundle, runs as the non-root `nextwiki` user, applies migrations at startup, and then starts the server.
- Production requires a stable `NEXTWIKI_SECRET` of at least 32 characters. The container entrypoint can generate an ephemeral secret when Compose leaves it empty, but that invalidates HMAC-derived sessions/tokens after a restart and is not suitable for production.
- `/api/health` checks process liveness. `/api/ready` queries PostgreSQL and checks the storage adapter as described above.
- Backup and restore are CLI operations in `scripts/backup.ts` and `scripts/restore.ts`; the `backup.create` permission is not consulted by those operating-system commands.
- There is no background worker or queue. Email delivery and media work happen in the request/command process.

## Current Security and Integration Boundaries

The architecture describes the implemented system, including these v0.1.0 boundaries:

- The JSON resource API has no stable cross-origin, API-key, or API-token contract. Keep it same-origin and limited to trusted application integrations; deployments with untrusted accounts must not treat it as a general-purpose or multi-tenant API boundary.
- Current-user and admin-user response shapes reflect internal application records rather than a stable, minimized public DTO contract. Consumers and logs must allowlist only required fields.
- Page resource reads can expose draft/archived records to any actor with `page.read`. Search, category, and maintenance discovery paths are published-only, but a known archived slug can still resolve through direct article/history UI; archival status is not a confidentiality boundary.
- Upload detection can trust the declared MIME type when byte detection returns no result.
- Request IDs are added to response headers, but audit write sites generally do not attach them to `audit_logs`.

Do not present those areas as stronger guarantees in deployment or security documentation until code and tests prove the guarantees.

---

## 简体中文

> [English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.md#简体中文)

NoviqWiki 是一个采用 TypeScript/Next.js App Router 的模块化单体应用，以 PostgreSQL 和 Drizzle ORM 为后端。基准部署由一个应用进程、一个 PostgreSQL 数据库和持久媒体存储组成。

### 运行拓扑

```text
浏览器或 API 客户端
        |
        v
Next.js 应用
  - React Server Components 与服务器操作
  - /api/v1 JSON 路由处理器
  - /api/health 与 /api/ready
        |
        +-------------------+
        v                   v
   PostgreSQL        本地文件系统或 S3 兼容存储
```

- Next.js 提供公开 Wiki 页面、已登录编辑/工作区页面、管理页面、本地媒体直接读取和 JSON 路由。
- PostgreSQL 存储主站点及设置、身份与会话、RBAC、内容状态、不可变修订、每用户草稿、当前链接/分类/搜索投影、监视列表、媒体元数据、审计事件和限流事件。
- 本地媒体字节位于 `NEXTWIKI_MEDIA_ROOT`；S3 兼容媒体字节位于配置的存储桶。
- `compose.yaml` 运行应用和 PostgreSQL，并为数据库、本地媒体及备份使用命名卷。
- 运行时目前通过 `getPrimarySiteWithSettings` 加载一个主站点。许多表带有 `siteId`，用于隔离和未来多站点工作，但 v0.1.0 按单站点应用运行。

### 请求与写操作流程

预期边界为：

```text
路由/页面/服务器操作 -> 解析输入并确定操作者 -> 领域服务 -> Drizzle/PostgreSQL 或存储
```

- `src/app/api/v1/**/route.ts` 中的 JSON 写操作处理器使用 Zod 解析请求体，并调用 `src/modules/**` 中的服务。
- `src/app/actions.ts` 中的服务器操作会在需要时建立当前会话、提取表单值并委托给领域服务。大多数特权分支会在委托前检查权限；每个新分支都必须显式执行该检查。
- 只读 React Server Components 通过服务取得领域数据。
- 全局权限检查目前主要集中在路由/服务器操作边界。页面服务会额外独立执行受保护页面写操作所需的 `page.protect`，但大多数服务不会重复所有全局权限检查。内部调用方不得绕过已授权边界。
- 输入校验尚未统一：许多表单操作使用带类型的提取辅助函数，大多数查询字符串/路由参数没有通过 Zod 解析。新边界应在调用服务前校验所有不可信输入。

已知边界例外：`src/app/admin/status/page.tsx` 会直接从 Server Component 执行数据库就绪查询，`src/app/admin/page.tsx` 也会直接查询数据库表以生成仪表盘计数。如果“组件不查询数据库”要成为绝对规则，应把这些读取移到运维/管理服务之后。

### 源码布局与职责

- `src/app/**`：App Router 页面、布局、路由处理器和服务器操作。这里只做编排，不新增可复用领域规则。
- `src/components/**`：可复用 UI 和编辑器组件。组件应接收数据或调用已批准的服务器边界，不应导入数据库表。
- `src/modules/pages/**`：页面生命周期、草稿、发布、修订、链接、维护报告、引用格式、保护和当前内容投影。
- `src/modules/rendering/**`：Markdown、GFM、数学公式、语法高亮、净化、标题、Wiki 链接和纯文本派生。
- `src/modules/redirects/**`：内容重定向解析、解析跳转、循环/深度检查和重定向报告。
- `src/modules/auth/**`、`src/modules/authorization/**` 和 `src/modules/users/**`：凭据、会话、恢复、限流、用户组、角色、权限和用户生命周期。
- `src/modules/search/**`、`src/modules/categories/**`、`src/modules/activity/**` 和 `src/modules/watchlist/**`：发现与用户活动的读取模型。
- `src/modules/media/**`：上传检查、元数据、引用发现和本地/S3 存储适配器。
- `src/modules/settings/**`、`src/modules/setup/**` 和 `src/modules/audit/**`：安装、站点设置、首页配置和审计事件。
- `src/modules/plugins/**`：小型进程内注册表；见下文“扩展边界”。
- `src/db/**`：Drizzle 客户端、Schema 和主站点查询辅助函数。
- `drizzle/**`：已提交的 SQL 迁移和 Drizzle 迁移元数据。
- `scripts/**`：迁移、种子、搜索重建索引、备份、恢复、一次性 E2E 设置、UI 审计和 OpenAPI 生成命令。
- `src/i18n/**`：英文和简体中文消息契约，以及语言相关格式化辅助函数。

### 持久化模型

#### 站点、身份与授权

- `sites` 和 `site_settings` 保存主站点及可配置行为。
- `users` 保存规范化身份字段和 Argon2id 密码哈希。
- `sessions` 保存 HMAC 派生的会话/CSRF 哈希、过期时间、吊销状态、User-Agent 和哈希后的客户端 IP 元数据。
- `groups`、`roles`、`permissions`、`user_groups`、`group_roles` 和 `role_permissions` 实现由用户组中介的 RBAC。用户与角色之间没有直接关系。
- 验证和密码重置 Token 表保存 HMAC 派生的 Token 值、过期时间和使用时间。

#### 内容

- `pages` 保存当前身份和生命周期状态：标题、规范化标题、路径名、当前修订、状态、保护、删除和归档元数据。
- `page_drafts` 为每个“页面/编辑者”组合保存一份可变草稿。保存草稿会更新该记录，不会创建修订。
- `page_revisions` 保存不可变的已发布快照：源 Markdown、净化 HTML、纯文本、哈希、修订谱系/编号、编辑者归属、编辑摘要、标题、分类和出站目标标题。
- `page_aliases` 把旧路径名或替代路径名映射到当前页面。内容编写的重定向仍是修订中的 Markdown 指令，而不是独立重定向表中的记录。
- `page_categories`、`page_links` 和 `search_index` 是当前已发布修订的可替换投影，不是规范历史。
- `page_watchlist` 记录每用户监视的页面。

#### 媒体与运维

- `media_assets` 保存元数据和存储键；对象字节保留在所选存储后端。
- `audit_logs` 保存结构化操作事件。虽然存在 `requestId`、`ipHash` 和 `userAgent` 列，但当前领域写入点通常不会填充请求元数据。
- `rate_limit_events` 当前用于登录尝试限流。

### 发布事务

Markdown 是规范来源。成功发布或回滚会在数据库事务中完成以下工作：

1. 加载页面，拒绝已删除状态、缺少 `page.protect` 的受保护写操作，以及可检测的重定向循环。普通发布还会拒绝过期基础修订；回滚会验证目标修订属于该页面。
2. 把 Markdown 渲染成净化 HTML、可读纯文本、标题、分类声明和 Wiki 链接目标。
3. 插入新的不可变 `page_revisions` 记录。
4. 让 `pages.currentRevisionId` 指向新修订，并把页面设为 `published`。
5. 普通发布会删除发布者的可变草稿；回滚会保留现有草稿不变。
6. 替换当前分类和链接投影。
7. 更新 PostgreSQL 搜索投影。
8. 写入相关审计事件。

保存草稿刻意采用不同流程：它更新或插入 `page_drafts` 并写入审计事件，不渲染，也不创建不可变修订。

### 渲染与搜索

渲染器使用 Unified 流水线：

```text
Markdown
 -> Wiki 链接预处理
 -> remark-parse + remark-gfm + remark-math
 -> remark-rehype（禁用原始 HTML）
 -> 标题 ID + KaTeX + 语法高亮
 -> rehype-sanitize
 -> 已存储 HTML 与派生纯文本
```

已发布页面会更新专用 `search_index` 表。PostgreSQL 使用 `simple` 配置生成 `tsvector`，对标题/别名/分类/正文加权，并提供前缀查询和不区分大小写的子字符串回退。`src/modules/search/service.ts` 是面向 UI 的服务边界，但目前直接包含 PostgreSQL/Drizzle 查询；尚未实现 `SearchAdapter` 接口或 OpenSearch 适配器。

### 身份验证与授权

- 本地用户名/邮箱凭据使用 Argon2id 哈希。
- 登录成功会创建 14 天数据库会话，并设置 `noviqwiki_session`（`HttpOnly`）及 `noviqwiki_csrf`（浏览器可读）；两者均为 `SameSite=Lax`，生产环境启用 `Secure`。
- 权限计算会合并用户所在所有用户组所分配全部角色的权限。
- 匿名用户只能获得 `site.view`、`page.read`、`revision.read` 和 `media.read`，且仅在启用 `publicMode` 时有效。
- 内置 Administrator 和 Owner 角色目前都拥有全部权限键。Owner 还受“至少保留一个活跃 Owner”不变量保护。
- `/admin/**` 外层布局要求 `site.configure`。`audit.read` 等较窄权限可能允许 JSON 路由，但不会单独授予相应管理页面访问权。

准确角色授权、受保护页面规则和当前执行缺口见 `docs/AUTHORIZATION.md`。

### 媒体架构

`StorageAdapter` 定义 `put`、`delete`、`getPublicUrl` 和 `isReady`。

- `LocalStorageAdapter` 在 `NEXTWIKI_MEDIA_ROOT` 下使用随机存储键，拒绝根目录外的路径穿越，并在校验 `media.read` 后通过 `/media/[...key]` 提供字节。当前本地响应带有 `public, max-age=31536000, immutable`。私有部署必须禁用代理/CDN 共享缓存。若部署要求在退出登录、移除权限、切换私有模式或删除后立即撤销访问，则必须把该路由改为 `Cache-Control: private, no-store`，并清除已缓存对象或轮换此前分发的 URL。
- `S3StorageAdapter` 使用 S3 兼容端点，并把通过授权的 `/media/[...key]` 读取重定向到短期签名地址。上传时返回的签名地址不是持久内容标识；页面内容应使用同源媒体路由和存储键。
- 运行时适配器由 `NEXTWIKI_MEDIA_DRIVER` 选择。设置时采集的 `site_settings.media_driver` 会持久化，但 `getStorageAdapter` 不会读取它；部署必须保持环境变量配置一致。
- 本地就绪检查会创建/检查媒体目录。S3 就绪检查目前只确认存在存储桶名称，不会联系 S3。
- 上传校验执行大小和允许列表检查。当字节检测失败时，目前会回退到客户端声明的 MIME 类型；这是已知加固缺口，不是完整内容验证。

### 国际化

消息契约位于 `src/i18n/en.ts`；`src/i18n/zh-CN.ts` 必须具有相同结构。产品 UI 支持 `en` 和 `zh-CN`。

大多数请求相关消息通过 `getRequestLocale` 使用以下优先级：

1. `noviqwiki-locale` Cookie。
2. 活跃用户存储的语言。
3. 包含中文的 `Accept-Language`。
4. 传入的站点默认语言，然后回退到英文。

根布局目前按 Cookie、活跃用户、站点默认语言的顺序解析，并不会读取 `Accept-Language`。更改语言行为时应让两条解析路径保持一致。用户编写的标题、Markdown、自定义角色/用户组名称和编辑摘要不会被翻译。

### 站点定制

`site_settings` 保存 Logo/Favicon 地址、标语/页脚文案、SEO 元数据、首页文案、布局模式、区块可见性和精选页面/分类路径名。首页优先加载配置且已发布的精选内容；没有配置页面能够解析时，回退到最近发布内容。渲染保持在服务器端。

### 扩展边界

`src/modules/plugins/registry.ts` 是带插件元数据和可选首页贡献的内存注册表。首页会读取已注册贡献，单元测试覆盖注册表行为。v0.1.0 不会发现软件包、从配置加载插件、沙箱化代码、提供市场或持久化注册信息。应把它视为内部扩展接缝，而不是用户可安装的插件系统。

### 部署与运维

- 生产镜像构建 Next.js standalone 包，以非 root 用户 `nextwiki` 运行，在启动服务器前应用迁移。
- 生产环境要求至少 32 个字符的稳定 `NEXTWIKI_SECRET`。当 Compose 留空时，容器入口可以生成临时密钥，但重启后会使 HMAC 派生的会话/Token 失效，不适合生产环境。
- `/api/health` 检查进程存活。`/api/ready` 查询 PostgreSQL，并按上述方式检查存储适配器。
- 备份和恢复是 `scripts/backup.ts` 与 `scripts/restore.ts` 中的 CLI 操作；这些操作系统命令不会检查 `backup.create` 权限。
- 没有后台 Worker 或队列。邮件投递和媒体工作都在请求/命令进程中完成。

### 当前安全与集成边界

本架构描述已实现系统，也包括以下 v0.1.0 边界：

- JSON 资源 API 没有稳定的跨域、API 密钥或 API Token 契约。应保持同源并限于受信任的应用集成；包含不受信任账户的部署不得把它当作通用或多租户 API 边界。
- 当前用户和管理用户响应结构反映内部应用记录，而不是稳定、最小化的公开 DTO 契约。消费者和日志必须通过允许列表只使用所需字段。
- 页面资源读取可能向任何具有 `page.read` 的操作者暴露草稿/已归档记录。搜索、分类和维护发现路径仅包含已发布内容，但已知的归档 slug 仍可通过直接条目/历史界面解析；归档状态不是保密边界。
- 当字节检测没有结果时，上传检测可能信任声明的 MIME 类型。
- 请求 ID 会添加到响应头，但审计写入点通常不会把它附加到 `audit_logs`。

在代码和测试证明相关保证前，不应在部署或安全文档中把这些方面描述得更强。
