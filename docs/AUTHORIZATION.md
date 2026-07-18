# NoviqWiki Authorization

> [English](AUTHORIZATION.md) | [简体中文](AUTHORIZATION.md#简体中文)

NoviqWiki uses local credential authentication, database sessions, and group-mediated role-based access control (RBAC). Authorization decisions are made on the server. Hiding a button in the UI is never an authorization boundary.

## Authentication Model

- Users sign in with a username or email and password.
- Passwords are hashed with Argon2id. The database stores password hashes, never plaintext passwords.
- A successful login creates a database session with a 14-day expiry.
- `noviqwiki_session` is `HttpOnly`; `noviqwiki_csrf` is browser-readable. Both cookies are `SameSite=Lax` and use path `/`.
- A session is valid only when both cookie values match their HMAC-derived database values, the session is unexpired/unrevoked, and the user status is `active`.
- Resetting a password revokes all sessions for that user. Administrators can also reset a user's sessions from the UI.

Cookie transport is determined by the environment `NOVIQWIKI_BASE_URL`: both Cookies are `Secure` when its protocol is `https:` and non-Secure when it is `http:`, regardless of `NODE_ENV` or the site URL stored in PostgreSQL. Production must configure the environment URL to the external HTTPS origin.

Setup is unauthenticated only while provisioning an Owner. With no site, it creates the site, settings, authorization defaults, and Owner in one transaction. With an existing site and no active Owner, it exposes only the Owner-account steps and preserves existing site/content data. An active Owner closes setup. The no-active-Owner state is a claimable administrative boundary: keep the instance isolated until a trusted operator completes Owner bootstrap.

Public registration first checks for site settings and an active Owner without serializing normal registrations. If that preflight finds an incomplete setup, it reacquires the state under the same transaction-scoped PostgreSQL advisory lock as both setup paths. Consequently, even `open` or `email_verification` registration cannot race Owner bootstrap; it returns `setup_required` while no active Owner exists, or proceeds only after the Owner transaction has completed.

Registration modes are `open`, `email_verification`, `invite`, and `closed`. In current code, both `invite` and `closed` reject public registration. There is no invitation-token or invitation-email workflow in v0.1.0; administrators create users through the server-action-backed admin UI.

## RBAC Relationship Model

```text
user -> user_groups -> group -> group_roles -> role -> role_permissions -> permission
```

- Users receive permissions only through group membership. There is no direct user-to-role assignment.
- A group may have multiple roles, and a user may belong to multiple groups.
- Effective permissions are the union of every assigned role permission.
- Custom groups and custom roles are supported.
- Built-in groups cannot be renamed. Built-in roles cannot be edited.
- Setup creates the `Owners` and `Readers` groups, assigns the singular built-in `Owner` and `Reader` roles respectively, and puts the first user in `Owners`.
- The service prevents a group/role membership or status change that would remove the final active Owner.

Public/self-registration creates the user and adds it to `Readers` in the same transaction, so an activated account receives the default Reader permissions immediately. Email-verification registrations remain `pending` until their token is consumed.

## Permission Catalog

| Permission       | Purpose                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| `site.view`      | Declared site-visibility capability; not independently enforced by a route or layout. |
| `site.configure` | Access site administration and change settings.                                       |
| `page.read`      | Read and discover pages.                                                              |
| `page.create`    | Create a page or initial draft.                                                       |
| `page.edit`      | Save drafts and submit page content changes.                                          |
| `page.publish`   | Publish Markdown as an immutable revision.                                            |
| `page.protect`   | Protect/unprotect pages and mutate a protected page.                                  |
| `page.rename`    | Rename a page and change its slug.                                                    |
| `page.delete`    | Soft-delete or archive a page.                                                        |
| `page.restore`   | Restore deleted or archived pages.                                                    |
| `page.rollback`  | Publish a new revision copied from an old revision.                                   |
| `revision.read`  | Read revision history and API revision resources.                                     |
| `media.read`     | Browse metadata and fetch media bytes.                                                |
| `media.upload`   | Upload media.                                                                         |
| `media.delete`   | Delete media.                                                                         |
| `user.read`      | List/search users through authorized API/UI paths.                                    |
| `user.manage`    | Create users, change status/groups, and reset sessions.                               |
| `group.read`     | List groups and role assignments.                                                     |
| `group.manage`   | Create/update groups and their roles.                                                 |
| `role.read`      | List roles and permission grants.                                                     |
| `role.manage`    | Create/update custom roles.                                                           |
| `audit.read`     | Read and filter audit events.                                                         |
| `backup.create`  | Declared backup capability; see the operational note below.                           |

## Built-in Roles

The seed grants are exact and cumulative only where stated below.

| Role            | Default permissions                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Reader`        | `site.view`, `page.read`, `revision.read`, `media.read`                                                                        |
| `Contributor`   | Reader grants plus `page.create`, `page.edit`, `media.upload`                                                                  |
| `Editor`        | Contributor grants plus `page.publish`                                                                                         |
| `Moderator`     | Editor grants plus `page.protect`, `page.rename`, `page.delete`, `page.restore`, `page.rollback`, `media.delete`, `audit.read` |
| `Administrator` | Every permission in the catalog                                                                                                |
| `Owner`         | Every permission in the catalog, plus final-active-Owner protection                                                            |

`Editor` does not receive `page.rollback`; rollback starts with `Moderator`. Administrator and Owner currently have the same permission keys, but Owner membership is protected by the final-active-Owner invariant.

## Anonymous Access and Public Mode

When no user session exists and `publicMode` is enabled, `hasPermission` grants only:

- `site.view`
- `page.read`
- `revision.read`
- `media.read`

When `publicMode` is disabled, an anonymous user receives none of those permissions. Public routes redirect to login or hide the resource as not found. Direct media reads also require `media.read`.

`site.view` is currently only a declared catalog capability. No route or layout independently checks it, and the site shell is not gated by it. Page, revision, and media boundaries instead check their respective read permissions.

An authenticated user is evaluated only through group membership, even on a public wiki. An account with no groups does not fall back to anonymous public-read permissions.

## Default Action Matrix

This matrix describes built-in role grants. Protected-page and visibility rules below may further restrict an allowed action.

| Action                                         | Anonymous        | Reader | Contributor | Editor | Moderator | Administrator | Owner |
| ---------------------------------------------- | ---------------- | ------ | ----------- | ------ | --------- | ------------- | ----- |
| Read public UI/search/categories/media         | Public mode only | Yes    | Yes         | Yes    | Yes       | Yes           | Yes   |
| Create a page/draft                            | No               | No     | Yes         | Yes    | Yes       | Yes           | Yes   |
| Save an ordinary-page draft                    | No               | No     | Yes         | Yes    | Yes       | Yes           | Yes   |
| Publish an ordinary page                       | No               | No     | No          | Yes    | Yes       | Yes           | Yes   |
| Upload media                                   | No               | No     | Yes         | Yes    | Yes       | Yes           | Yes   |
| Read revision resources                        | Public mode only | Yes    | Yes         | Yes    | Yes       | Yes           | Yes   |
| Roll back an ordinary page                     | No               | No     | No          | No     | Yes       | Yes           | Yes   |
| Protect/unprotect a page                       | No               | No     | No          | No     | Yes       | Yes           | Yes   |
| Rename/delete/archive/restore an ordinary page | No               | No     | No          | No     | Yes       | Yes           | Yes   |
| Delete media                                   | No               | No     | No          | No     | Yes       | Yes           | Yes   |
| Read audit events                              | No               | No     | No          | No     | Yes       | Yes           | Yes   |
| Manage users/groups/roles/settings             | No               | No     | No          | No     | No        | Yes           | Yes   |

Media permission is independent from page editing for custom roles. The default roles happen to give `media.upload` to roles that can edit, but code checks `media.upload`, not `page.edit`.

## Authorization Boundaries

### Route handlers and server actions

API routes and server actions establish the session and check the required permission before restricted reads or mutations. JSON mutation bodies, route UUIDs, and bounded list queries use Zod schemas. `PATCH /api/v1/pages/{id}` uses a strict operation union, so empty, unknown, and mixed operation bodies are rejected instead of falling through to a read.

### Domain services

Most global permission checks occur before the service call. Domain services accept actor IDs for attribution and audit, but they do not all independently call `requirePermission`. The page service does enforce the extra protected-page rule internally. Code that calls a service directly must first establish the same authorized boundary; actor ID alone is not authorization.

### Administration UI

Every `/admin/**` page passes through `src/app/admin/layout.tsx`, which requires `site.configure`. As a result, a custom role or Moderator with `audit.read` can call the audit JSON endpoint but cannot open `/admin/audit` without also receiving `site.configure`. Apply the same reasoning to other narrow admin permissions. Either grant `site.configure`, use the permission-specific API, or refactor the admin layout before promising fine-grained admin UI access.

Data-bearing admin pages also require their narrower read permissions: for example, audit requires `audit.read`, media requires `media.read`, and user administration requires `user.read`, `group.read`, and `role.read`. Server actions independently recheck their mutation-specific manage/write permissions.

## Page Visibility

There are no per-page read ACLs in v0.1.0. `publicMode` controls anonymous read access globally, and `protectionLevel` controls writes only.

Search, category, and maintenance discovery queries explicitly filter for `status = published` and non-deleted pages. However, direct article/history UI and JSON page resource paths are broader:

- `GET /api/v1/pages` defaults to published pages; requesting drafts additionally requires `page.edit`, while archived or deleted listings require `page.restore`.
- `GET /api/v1/pages/{id}` and revision-read helpers reject drafts and deleted pages but allow archived page records.
- A known archived slug with a current revision can still resolve through the direct article and history UI.
- `/recent` filters public results by audit action name, not by target publication status. It can expose draft, archived, or deleted page metadata and media labels/URLs to anyone with `page.read`, including anonymous public-mode readers.
- An authenticated watchlist excludes deleted pages but continues to list watched draft and archived pages.

Therefore, do not equate `page.read` or archival status with a published-only confidentiality boundary. Treat this as an access-control hardening gap if draft titles or archived content are confidential.

## Page Protection

`protectionLevel = protected` adds a service-layer requirement: the actor must have `page.protect` before any of these operations are applied:

- Save a draft.
- Publish Markdown.
- Roll back.
- Rename.
- Soft-delete.
- Archive.
- Restore/unarchive.

Protection/unprotection itself also requires `page.protect` at the route/action boundary. Protection does not create a page read ACL.

## Revision Access

The JSON revision endpoints require `revision.read` and then reject revisions whose page is deleted. The web history UI primarily checks `page.read`. Built-in roles receive both permissions together, but custom roles can separate them and observe this API/UI distinction.

Rollback requires `page.rollback`; a protected target page additionally requires `page.protect`. Rollback inserts a new published revision and never changes an existing revision.

## Media Access

- The dedicated media library/API, `/admin/media`, and application-served bytes require `media.read`. New/edit pages can still list assets through their page-editing boundary, and recent-change feeds can expose media labels/URLs with `page.read`.
- Upload requires `media.upload`.
- Deletion requires `media.delete`.
- Uploads are not associated with a page at upload time. Before non-forced deletion, reference discovery scans every stored revision and draft for the stored URL, stable `/media/{storageKey}` URL, or safe filename. It remains a substring heuristic, so it is not referential integrity; the explicit force path bypasses a detected conflict.
- Size and safe MIME allowlists are enforced. Binary MIME types are derived from bytes, valid UTF-8 plain text is recognized explicitly, and otherwise the type becomes `application/octet-stream`; the client-declared type is not trusted.
- Local and S3 objects use the same stable `/media/{storageKey}` URL. Each request checks `media.read` and the application streams the object in a same-origin response; it does not persist or redirect to a presigned S3 URL.
- The response uses `Cache-Control: public, max-age=0, must-revalidate` only when an anonymous actor has `media.read`. Authenticated-only media uses `private, no-store, max-age=0`, so authorization is re-evaluated instead of relying on a shared cached object.

## Session and CSRF Boundary

The supported account and form workflows use the same-origin browser/server-action boundary. `/api/v1` has no stable cross-origin, API-key, or API-token contract in v0.1.0. Keep cookie-authenticated JSON writes same-origin and limited to trusted application integrations; do not present the resource routes as a third-party authentication API.

Cookie-authenticated unsafe `/api/v1` methods require the matching `x-csrf-token`. They reject a conflicting `Origin` and reject cross-site Fetch Metadata when `Origin` is absent. The API still has no cross-origin authentication contract, and `SameSite=Lax` remains defense in depth.

## Sensitive Response Data

`/api/v1/me` and administrative user reads return an allowlisted safe user DTO and never return `passwordHash`. `/api/v1/me` additionally returns the session's raw CSRF token for same-origin writes; clients and logs must still treat that token as sensitive.

## Audit Expectations and Current Behavior

Many privileged services write structured audit events with action, target, actor attribution, details, and timestamp, but coverage is not complete for every user/group administration path. The schema also supports request ID, hashed IP, and User-Agent. Most current service call sites do not pass those request metadata fields, so they are usually null.

Audit details must never contain passwords, session/CSRF tokens, raw cookies, password/reset tokens, or full page bodies. `src/lib/logger.ts` currently configures Pino but does not provide a complete field-redaction layer; every logging call and downstream sink must enforce an explicit allowlist of fields needed for the operational event.

## Backup Permission and Owner Recovery

`backup.create` is present in RBAC and granted to Administrator/Owner, but `pnpm backup` and `pnpm restore` are operating-system CLI commands and do not authenticate an application actor. Access to those commands, the database, storage, and backup directory must be controlled by deployment permissions.

Keep at least two active Owner accounts. Whenever a site has no active Owner, the unauthenticated Owner-only setup path is the supported bootstrap and preserves existing site/content records. Because this can create a new Owner even when other user rows remain, treat the state as an exposed administrative recovery boundary and isolate the instance until bootstrap completes.

## Enforcement Checklist for New Work

1. Parse every untrusted body, query string, route parameter, and form field.
2. Establish the current session and primary site.
3. Check the exact permission key before reading restricted data or mutating state.
4. For page writes, use page services so protected-page checks cannot be skipped.
5. Use transactions for multi-table invariants such as publication and role/group replacement.
6. Return a stable, minimized DTO and allowlist logged response fields.
7. Keep cookie-authenticated non-server-action writes same-origin; add an explicit, tested CSRF contract before supporting broader clients.
8. Write an audit event without secrets or full content.
9. Add integration tests for allowed, denied, anonymous/private, inactive-user, protected-page, and final-Owner paths.

---

## 简体中文

> [English](AUTHORIZATION.md) | [简体中文](AUTHORIZATION.md#简体中文)

NoviqWiki 使用本地凭据身份验证、数据库会话和由用户组中介的基于角色访问控制（RBAC）。授权决策在服务器端完成。UI 中隐藏按钮绝不是授权边界。

### 身份验证模型

- 用户使用用户名或邮箱及密码登录。
- 密码使用 Argon2id 哈希。数据库存储密码哈希，绝不存储明文密码。
- 登录成功会创建有效期 14 天的数据库会话。
- `noviqwiki_session` 为 `HttpOnly`；`noviqwiki_csrf` 可由浏览器读取。两个 Cookie 都是 `SameSite=Lax`，路径为 `/`。
- 只有两个 Cookie 值与数据库中的 HMAC 派生值匹配、会话未过期/未吊销且用户状态为 `active` 时，会话才有效。
- 重置密码会吊销该用户的所有会话。管理员也可从 UI 重置用户会话。

Cookie 传输由环境变量 `NOVIQWIKI_BASE_URL` 决定：其协议为 `https:` 时两个 Cookie 都启用 `Secure`，为 `http:` 时则不启用，与 `NODE_ENV` 或 PostgreSQL 中保存的站点 URL 无关。生产环境必须把该环境 URL 配置为外部 HTTPS 源。

只有在配置 Owner 时，设置流程才无需身份验证。不存在站点时，它会在一个事务中创建站点、设置、授权默认值和 Owner；已有站点但没有活跃 Owner 时，只显示 Owner 账号步骤，并保留现有站点/内容数据。存在活跃 Owner 后设置即关闭。无活跃 Owner 状态是可被取得的管理边界：受信运维人员完成 Owner 引导前，必须隔离实例。

公开注册会先在不串行化正常注册的情况下检查站点设置与活跃 Owner。若预检发现设置未完成，它会在与两条设置路径相同的 PostgreSQL 事务级 advisory lock 内重新检查状态。因此，即使注册模式为 `open` 或 `email_verification`，注册也不能与 Owner 引导竞争；没有活跃 Owner 时会返回 `setup_required`，只有 Owner 事务完成后才可能继续。

注册模式为 `open`、`email_verification`、`invite` 和 `closed`。当前代码中，`invite` 与 `closed` 都会拒绝公开注册。v0.1.0 没有邀请 Token 或邀请邮件流程；管理员通过服务器操作支持的管理界面创建用户。

### RBAC 关系模型

```text
用户 -> user_groups -> 用户组 -> group_roles -> 角色 -> role_permissions -> 权限
```

- 用户只通过用户组成员关系获得权限。用户与角色之间没有直接分配关系。
- 一个用户组可以有多个角色，一个用户可以属于多个用户组。
- 有效权限是所有已分配角色权限的并集。
- 支持自定义用户组和自定义角色。
- 内置用户组不可重命名；内置角色不可编辑。
- 设置流程创建 `Owners` 和 `Readers` 用户组，分别分配单数形式的内置 `Owner` 和 `Reader` 角色，并把首位用户加入 `Owners`。
- 服务会阻止导致最后一个活跃 Owner 消失的用户组/角色成员关系或状态变更。

公开/自助注册会在同一事务中创建用户并加入 `Readers`，因此激活后的账户会立即获得默认 Reader 权限。邮箱验证注册在消费验证 Token 前保持 `pending`。

### 权限目录

| 权限             | 用途                                                 |
| ---------------- | ---------------------------------------------------- |
| `site.view`      | 已声明的站点可见性能力；当前没有路由或布局独立执行。 |
| `site.configure` | 访问站点管理并更改设置。                             |
| `page.read`      | 读取和发现页面。                                     |
| `page.create`    | 创建页面或初始草稿。                                 |
| `page.edit`      | 保存草稿并提交页面内容变更。                         |
| `page.publish`   | 把 Markdown 发布成不可变修订。                       |
| `page.protect`   | 保护/取消保护页面，并修改受保护页面。                |
| `page.rename`    | 重命名页面并更改路径名。                             |
| `page.delete`    | 软删除或归档页面。                                   |
| `page.restore`   | 恢复已删除或已归档页面。                             |
| `page.rollback`  | 从旧修订复制并发布新修订。                           |
| `revision.read`  | 读取修订历史和 API 修订资源。                        |
| `media.read`     | 浏览元数据并获取媒体字节。                           |
| `media.upload`   | 上传媒体。                                           |
| `media.delete`   | 删除媒体。                                           |
| `user.read`      | 通过授权 API/UI 路径列出/搜索用户。                  |
| `user.manage`    | 创建用户、更改状态/用户组并重置会话。                |
| `group.read`     | 列出用户组及角色分配。                               |
| `group.manage`   | 创建/更新用户组及其角色。                            |
| `role.read`      | 列出角色及权限授权。                                 |
| `role.manage`    | 创建/更新自定义角色。                                |
| `audit.read`     | 读取和筛选审计事件。                                 |
| `backup.create`  | 已声明的备份能力；见下方运维说明。                   |

### 内置角色

下列为准确的种子授权；只有明确说明时才表示累加。

| 角色            | 默认权限                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Reader`        | `site.view`、`page.read`、`revision.read`、`media.read`                                                                     |
| `Contributor`   | Reader 权限，加 `page.create`、`page.edit`、`media.upload`                                                                  |
| `Editor`        | Contributor 权限，加 `page.publish`                                                                                         |
| `Moderator`     | Editor 权限，加 `page.protect`、`page.rename`、`page.delete`、`page.restore`、`page.rollback`、`media.delete`、`audit.read` |
| `Administrator` | 权限目录中的全部权限                                                                                                        |
| `Owner`         | 权限目录中的全部权限，另有“至少保留一个活跃 Owner”保护                                                                      |

`Editor` 没有 `page.rollback`；从 `Moderator` 开始才可回滚。Administrator 与 Owner 当前拥有相同权限键，但 Owner 成员关系受“至少保留一个活跃 Owner”不变量保护。

### 匿名访问与公开模式

没有用户会话且已启用 `publicMode` 时，`hasPermission` 只授予：

- `site.view`
- `page.read`
- `revision.read`
- `media.read`

禁用 `publicMode` 后，匿名用户不会获得这些权限。公开路由会跳转登录，或把资源隐藏为不存在。直接媒体读取同样要求 `media.read`。

`site.view` 当前只是权限目录中已声明的能力。没有路由或布局独立检查它，站点外壳也不由它控制。页面、修订和媒体边界会分别检查相应读取权限。

即使 Wiki 公开，已登录用户也只按用户组成员关系计算。没有用户组的账户不会回退到匿名公开读取权限。

### 默认操作矩阵

此矩阵描述内置角色授权。下方受保护页面和可见性规则可能进一步限制已允许操作。

| 操作                          | 匿名       | Reader | Contributor | Editor | Moderator | Administrator | Owner |
| ----------------------------- | ---------- | ------ | ----------- | ------ | --------- | ------------- | ----- |
| 读取公开 UI/搜索/分类/媒体    | 仅公开模式 | 是     | 是          | 是     | 是        | 是            | 是    |
| 创建页面/草稿                 | 否         | 否     | 是          | 是     | 是        | 是            | 是    |
| 保存普通页面草稿              | 否         | 否     | 是          | 是     | 是        | 是            | 是    |
| 发布普通页面                  | 否         | 否     | 否          | 是     | 是        | 是            | 是    |
| 上传媒体                      | 否         | 否     | 是          | 是     | 是        | 是            | 是    |
| 读取修订资源                  | 仅公开模式 | 是     | 是          | 是     | 是        | 是            | 是    |
| 回滚普通页面                  | 否         | 否     | 否          | 否     | 是        | 是            | 是    |
| 保护/取消保护页面             | 否         | 否     | 否          | 否     | 是        | 是            | 是    |
| 重命名/删除/归档/恢复普通页面 | 否         | 否     | 否          | 否     | 是        | 是            | 是    |
| 删除媒体                      | 否         | 否     | 否          | 否     | 是        | 是            | 是    |
| 读取审计事件                  | 否         | 否     | 否          | 否     | 是        | 是            | 是    |
| 管理用户/用户组/角色/设置     | 否         | 否     | 否          | 否     | 否        | 是            | 是    |

对于自定义角色，媒体权限独立于页面编辑。默认角色恰好把 `media.upload` 授予可编辑角色，但代码检查的是 `media.upload`，不是 `page.edit`。

### 授权边界

#### 路由处理器与服务器操作

API 路由和服务器操作会建立会话，并在读取受限数据或变更状态前检查所需权限。JSON 写操作请求体、路由 UUID 和有界列表查询使用 Zod Schema。`PATCH /api/v1/pages/{id}` 使用严格操作联合，因此空请求体、未知字段和混合操作会被拒绝，不会回退为读取。

#### 领域服务

大多数全局权限检查发生在服务调用之前。领域服务接收操作者 ID 用于归属和审计，但不会全部独立调用 `requirePermission`。页面服务会在内部执行额外的受保护页面规则。直接调用服务的代码必须先建立相同的授权边界；仅有操作者 ID 不代表已授权。

#### 管理界面

所有 `/admin/**` 页面都经过 `src/app/admin/layout.tsx`，它要求 `site.configure`。因此，只有 `audit.read` 的自定义角色或 Moderator 可以调用审计 JSON 端点，却不能在没有 `site.configure` 时打开 `/admin/audit`。其他较窄管理权限同理。应授予 `site.configure`、使用特定权限 API，或先重构管理布局，再承诺细粒度管理 UI 访问。

承载数据的管理页面还要求较窄读取权限：例如审计要求 `audit.read`，媒体要求 `media.read`，用户管理要求 `user.read`、`group.read` 和 `role.read`。服务器操作会独立重新检查各自变更所需的管理/写入权限。

### 页面可见性

v0.1.0 没有每页面读取 ACL。`publicMode` 只全局控制匿名读取，`protectionLevel` 只控制写入。

搜索、分类和维护发现查询会明确筛选 `status = published` 和未删除页面。但直接条目/历史界面及 JSON 页面资源路径范围更宽：

- `GET /api/v1/pages` 默认只列出已发布页面；请求草稿还要求 `page.edit`，请求已归档或已删除列表则要求 `page.restore`。
- `GET /api/v1/pages/{id}` 和修订读取辅助函数会拒绝草稿与已删除页面，但允许已归档页面记录。
- 已知的归档页面 slug 只要带有当前修订，仍可通过直接条目与历史界面解析。
- `/recent` 按审计操作名称筛选公开结果，而不是按目标发布状态筛选。因此，任何拥有 `page.read` 的主体（包括公开模式匿名读者）都可能看到草稿、已归档或已删除页面的元数据以及媒体标签/URL。
- 已登录用户的监视列表会排除已删除页面，但仍列出已监视的草稿和已归档页面。

因此，不应把 `page.read` 或归档状态等同于“仅已发布内容”的保密边界。如果草稿标题或归档内容属于机密信息，应把它视为访问控制加固缺口。

### 页面保护

`protectionLevel = protected` 会在服务层增加要求：执行以下操作前，操作者必须拥有 `page.protect`：

- 保存草稿。
- 发布 Markdown。
- 回滚。
- 重命名。
- 软删除。
- 归档。
- 恢复/取消归档。

保护/取消保护本身也在路由/操作边界要求 `page.protect`。保护不会创建页面读取 ACL。

### 修订访问

JSON 修订端点要求 `revision.read`，随后拒绝页面已删除的修订。网页历史 UI 主要检查 `page.read`。内置角色会同时获得两项权限，但自定义角色可以拆分，从而观察到 API/UI 差异。

回滚要求 `page.rollback`；受保护目标页面还要求 `page.protect`。回滚会插入新的已发布修订，绝不会修改现有修订。

### 媒体访问

- 专用媒体库/API、`/admin/media` 和应用提供的媒体字节要求 `media.read`。新建/编辑页面仍可通过页面编辑边界列出资源，最近更改信息流也可能凭 `page.read` 暴露媒体标签/URL。
- 上传要求 `media.upload`。
- 删除要求 `media.delete`。
- 上传时不会把媒体关联到页面。非强制删除前，引用发现会扫描所有已存修订与草稿，查找已存 URL、稳定的 `/media/{storageKey}` 地址或安全文件名。它仍是子字符串启发式扫描，不等于引用完整性；显式强制路径会绕过检测到的冲突。
- 会执行大小和安全 MIME 允许列表检查。二进制 MIME 类型从字节派生，有效 UTF-8 纯文本会被明确识别，其他内容使用 `application/octet-stream`；不会信任客户端声明的类型。
- 本地与 S3 对象使用同一个稳定 `/media/{storageKey}` 地址。每次请求都会检查 `media.read`，应用再通过同源响应流式返回对象；不会持久化预签名 S3 URL，也不会重定向到该 URL。
- 只有匿名主体拥有 `media.read` 时，响应才使用 `Cache-Control: public, max-age=0, must-revalidate`。仅限身份验证的媒体使用 `private, no-store, max-age=0`，从而重新判断授权，而不依赖共享缓存对象。

### 会话与 CSRF 边界

受支持的账户和表单流程使用同源浏览器/服务器操作边界。v0.1.0 的 `/api/v1` 没有稳定的跨域、API 密钥或 API Token 契约。使用 Cookie 身份验证的 JSON 写操作必须保持同源，并限于受信任的应用集成；不要把资源路由描述为第三方身份验证 API。

使用 Cookie 身份验证的非安全 `/api/v1` 方法要求匹配的 `x-csrf-token`。它们会拒绝冲突的 `Origin`；缺少 `Origin` 时还会拒绝跨站 Fetch Metadata。API 仍没有跨域身份验证契约，`SameSite=Lax` 继续作为纵深防御。

### 敏感响应数据

`/api/v1/me` 与管理用户读取会返回允许列表定义的安全用户 DTO，绝不会返回 `passwordHash`。`/api/v1/me` 还会返回会话原始 CSRF Token，供同源写操作使用；客户端和日志仍必须把该 Token 视为敏感信息。

### 审计预期与当前行为

许多特权服务会写入带操作、目标、操作者归属、详情和时间戳的结构化审计事件，但并非所有用户/用户组管理路径都已完整覆盖。Schema 也支持请求 ID、哈希 IP 和 User-Agent。大多数当前服务调用点没有传入这些请求元数据字段，因此它们通常为 null。

审计详情绝不能包含密码、会话/CSRF Token、原始 Cookie、密码/重置 Token 或完整页面正文。`src/lib/logger.ts` 当前只配置 Pino，并未提供完整的字段脱敏层；每个日志调用和下游接收端都必须通过显式允许列表限定为运维事件所需字段。

### 备份权限与 Owner 恢复

RBAC 中存在 `backup.create`，并授予 Administrator/Owner，但 `pnpm backup` 和 `pnpm restore` 是操作系统 CLI 命令，不会验证应用操作者。必须通过部署权限控制这些命令、数据库、存储和备份目录的访问。

至少保留两个活跃 Owner 账户。只要站点没有活跃 Owner，未认证的 Owner 专用设置路径就是受支持的引导方式，并会保留现有站点/内容记录。即使仍有其他用户记录，该路径也可以创建新 Owner，因此必须把此状态视为暴露的管理恢复边界，并在引导完成前隔离实例。

### 新功能执行检查表

1. 解析每个不可信请求体、查询字符串、路由参数和表单字段。
2. 建立当前会话和主站点。
3. 在读取受限数据或改变状态前检查准确权限键。
4. 页面写操作使用页面服务，确保不能跳过受保护页面检查。
5. 对发布、角色/用户组替换等多表不变量使用事务。
6. 返回稳定、最小化的 DTO，并通过允许列表记录响应字段。
7. 使用 Cookie 身份验证的非服务器操作写入应保持同源；在支持更广泛客户端前，先添加明确且经过测试的 CSRF 契约。
8. 写入不含机密或完整正文的审计事件。
9. 为允许、拒绝、匿名/私有、非活跃用户、受保护页面和最后 Owner 路径添加集成测试。
