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

Cookie transport is determined by the environment `NEXTWIKI_BASE_URL`: both Cookies are `Secure` when its protocol is `https:` and non-Secure when it is `http:`, regardless of `NODE_ENV` or the site URL stored in PostgreSQL. Production must configure the environment URL to the external HTTPS origin.

Setup is unauthenticated only while provisioning the first Owner. With no site, it creates the site, settings, authorization defaults, and Owner in one transaction. With an existing site and zero user rows, it exposes only the Owner-account steps and preserves existing site/content data. Any user row closes setup. The zero-user state is a claimable administrative boundary: keep the instance isolated until a trusted operator completes Owner bootstrap.

Public registration first checks for site settings and at least one existing user without serializing normal registrations. If that preflight finds an incomplete setup, it reacquires the state under the same transaction-scoped PostgreSQL advisory lock as both setup paths. Consequently, even `open` or `email_verification` registration cannot create the first account or race Owner bootstrap; it returns `setup_required` while no Owner exists, or proceeds only after the Owner transaction has completed.

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

Important current behavior: public/self-registration creates a user but does not add that user to `Readers`. Because authenticated users do not inherit anonymous permissions, a newly registered user has no effective permission until an administrator assigns a group. Administrators should assign every created/registered account to an appropriate group; the registration flow should be fixed before `open` registration is treated as complete self-service access.

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

API routes and server actions establish the session, and documented privileged operation branches generally call `requirePermission`/`hasPermission`. Session establishment alone is not authorization: every handler must reject unknown or no-op request shapes before reading restricted data or mutating state. JSON mutation bodies use Zod, but many server-action form values use extraction helpers instead of a Zod object, and most query strings and route parameters are not consistently schema-validated.

Concrete current gap: `PATCH /api/v1/pages/{id}` accepts an empty object or another schema-valid body that selects no operation. Its fallback returns the page and current revision by UUID to any active session without checking `page.read` or the normal page-visibility rules. Until the handler rejects no-op bodies or applies the read boundary, private mode and page permissions do not protect this fallback.

### Domain services

Most global permission checks occur before the service call. Domain services accept actor IDs for attribution and audit, but they do not all independently call `requirePermission`. The page service does enforce the extra protected-page rule internally. Code that calls a service directly must first establish the same authorized boundary; actor ID alone is not authorization.

### Administration UI

Every `/admin/**` page passes through `src/app/admin/layout.tsx`, which requires `site.configure`. As a result, a custom role or Moderator with `audit.read` can call the audit JSON endpoint but cannot open `/admin/audit` without also receiving `site.configure`. Apply the same reasoning to other narrow admin permissions. Either grant `site.configure`, use the permission-specific API, or refactor the admin layout before promising fine-grained admin UI access.

The inverse is also true: `site.configure` alone currently renders every `/admin/**` read page. Those page components load users, groups, roles, audit events, pages, and media without additionally enforcing `user.read`, `group.read`, `role.read`, `audit.read`, `page.read`, or `media.read`. Server actions still recheck their mutation-specific manage/write permissions.

## Page Visibility

There are no per-page read ACLs in v0.1.0. `publicMode` controls anonymous read access globally, and `protectionLevel` controls writes only.

Search, category, and maintenance discovery queries explicitly filter for `status = published` and non-deleted pages. However, direct article/history UI and JSON page resource paths are broader:

- `GET /api/v1/pages` lists non-deleted drafts and archived pages for anyone with `page.read` unless a `status` filter narrows it.
- `GET /api/v1/pages/{id}` and revision-read helpers reject deleted pages but currently allow draft/archived page records.
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

- The dedicated media library/API and application-served bytes require `media.read`. This is not a universal metadata boundary: new/edit pages list assets after only `page.create`/`page.edit`, `/admin/media` lists them after `site.configure`, and recent-change feeds can expose media labels/URLs with `page.read`.
- Upload requires `media.upload`.
- Deletion requires `media.delete`.
- Uploads are not associated with a page at upload time. Reference discovery is a case-insensitive substring scan of current published revision Markdown for the stored `publicUrl` or safe filename; it does not parse Markdown or search `storageKey`. It can produce false positives and false negatives, including missing the recommended S3 `/media/{storageKey}` form.
- Deletion returns a conflict only when that heuristic scan finds a reference, and the explicit force path bypasses the conflict. Do not treat it as referential integrity or a guarantee against deleting an in-use asset.
- Size and MIME allowlists are enforced, but when byte detection fails the validator currently falls back to the client-declared MIME type. Do not rely on the extension or declared type as proof of file content.
- Authorized local-media responses currently use a one-year `public, immutable` cache policy. Private deployments must disable shared proxy/CDN caching. To make logout, permission removal, private-mode changes, or deletion revoke access immediately, change the media route to `Cache-Control: private, no-store` and purge already cached objects or rotate previously distributed URLs.
- With S3, an authorized `/media/{storageKey}` request redirects to a one-hour presigned URL. Once issued, that URL is a bearer credential until expiry; logout, group changes, and private-mode changes do not revoke it. Uploads persist the expiring signed `publicUrl`, and current media-picker/editor paths can copy or insert it. For inline images, the redirect also conflicts with the default `img-src 'self' data: blob:` policy because the final S3 URL is cross-origin.

## Session and CSRF Boundary

The supported account and form workflows use the same-origin browser/server-action boundary. `/api/v1` has no stable cross-origin, API-key, or API-token contract in v0.1.0. Keep cookie-authenticated JSON writes same-origin and limited to trusted application integrations; do not present the resource routes as a third-party authentication API.

`assertCsrf` exists but currently has no call sites. Cookie-authenticated `/api/v1` mutations and `POST /logout` do not validate `Origin` or require `x-csrf-token`; `SameSite=Lax` is the current browser-level mitigation. Same-origin use is therefore an operational restriction, not an application-enforced API contract.

Same-origin is not a substitute for complete operation validation. Until route-operation validation and minimized response DTOs are completed, a deployment with untrusted accounts must not rely on `/api/v1` as a general-purpose or multi-tenant authorization boundary.

## Sensitive Response Data

`/api/v1/me` returns the active session's complete user row, including `passwordHash`, normalized username/email fields, and other internal columns, plus the raw `csrfToken`. `/api/v1/admin/users` returns complete user rows, including `passwordHash`, to callers with `user.read`. These are internal application shapes, not stable or minimized public DTOs. Restrict them to same-origin trusted use; request/response logging and downstream consumers must allowlist required fields instead of recording or forwarding raw response bodies.

## Audit Expectations and Current Behavior

Many privileged services write structured audit events with action, target, actor attribution, details, and timestamp, but coverage is not complete for every user/group administration path. The schema also supports request ID, hashed IP, and User-Agent. Most current service call sites do not pass those request metadata fields, so they are usually null.

Audit details must never contain passwords, session/CSRF tokens, raw cookies, password/reset tokens, or full page bodies. `src/lib/logger.ts` currently configures Pino but does not provide a complete field-redaction layer; every logging call and downstream sink must enforce an explicit allowlist of fields needed for the operational event.

## Backup Permission and Owner Recovery

`backup.create` is present in RBAC and granted to Administrator/Owner, but `pnpm backup` and `pnpm restore` are operating-system CLI commands and do not authenticate an application actor. Access to those commands, the database, storage, and backup directory must be controlled by deployment permissions.

Keep at least two active Owner accounts. If the database has zero user rows, the unauthenticated Owner-only setup path is the supported bootstrap and preserves the existing site/content records. If any user row remains but no active Owner is available, there is no supported Owner-recovery action or script; recovery requires controlled database intervention to repair user status and the `Owners` group relationship. Test and record a site-specific recovery runbook before production use, take a backup first, and audit the intervention externally.

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

Cookie 传输由环境变量 `NEXTWIKI_BASE_URL` 决定：其协议为 `https:` 时两个 Cookie 都启用 `Secure`，为 `http:` 时则不启用，与 `NODE_ENV` 或 PostgreSQL 中保存的站点 URL 无关。生产环境必须把该环境 URL 配置为外部 HTTPS 源。

只有在配置首个 Owner 时，设置流程才无需身份验证。不存在站点时，它会在一个事务中创建站点、设置、授权默认值和 Owner；已有站点且用户记录数为零时，只显示 Owner 账号步骤，并保留现有站点/内容数据。存在任意用户记录后设置即关闭。零用户状态是可被取得的管理边界：受信运维人员完成 Owner 引导前，必须隔离实例。

公开注册会先在不串行化正常注册的情况下检查站点设置与至少一条现有用户记录。若预检发现设置未完成，它会在与两条设置路径相同的 PostgreSQL 事务级 advisory lock 内重新检查状态。因此，即使注册模式为 `open` 或 `email_verification`，注册也不能创建首个账户或与 Owner 引导竞争；没有 Owner 时会返回 `setup_required`，只有 Owner 事务已完成后才可能继续。

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

重要的当前行为：公开/自助注册会创建用户，但不会把用户加入 `Readers`。由于已登录用户不会继承匿名权限，新注册用户在管理员分配用户组前没有任何有效权限。管理员应把每个已创建/已注册账户加入合适用户组；在把 `open` 注册视为完整自助访问前，应先修复注册流程。

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

API 路由和服务器操作会建立会话，已记录的特权操作分支通常会调用 `requirePermission`/`hasPermission`。仅建立会话并不等于授权：每个处理器都必须先拒绝未知或无操作请求结构，再读取受限数据或变更状态。JSON 写操作请求体使用 Zod，但许多服务器操作表单值通过提取辅助函数而不是 Zod 对象处理，大多数查询字符串和路由参数尚未统一进行 Schema 校验。

当前的具体缺口：`PATCH /api/v1/pages/{id}` 接受空对象或其他通过 Schema、但未选择任何操作的请求体。其回退分支会按 UUID 向任意活跃会话返回页面及当前修订，而不检查 `page.read` 或正常页面可见性规则。在处理器拒绝无操作请求体或应用读取边界前，私有模式和页面权限都无法保护该回退分支。

#### 领域服务

大多数全局权限检查发生在服务调用之前。领域服务接收操作者 ID 用于归属和审计，但不会全部独立调用 `requirePermission`。页面服务会在内部执行额外的受保护页面规则。直接调用服务的代码必须先建立相同的授权边界；仅有操作者 ID 不代表已授权。

#### 管理界面

所有 `/admin/**` 页面都经过 `src/app/admin/layout.tsx`，它要求 `site.configure`。因此，只有 `audit.read` 的自定义角色或 Moderator 可以调用审计 JSON 端点，却不能在没有 `site.configure` 时打开 `/admin/audit`。其他较窄管理权限同理。应授予 `site.configure`、使用特定权限 API，或先重构管理布局，再承诺细粒度管理 UI 访问。

反方向同样成立：目前仅有 `site.configure` 就足以渲染所有 `/admin/**` 读取页面。这些页面组件会加载用户、用户组、角色、审计事件、页面和媒体，而不会额外执行 `user.read`、`group.read`、`role.read`、`audit.read`、`page.read` 或 `media.read`。服务器操作仍会重新检查各自变更所需的管理/写入权限。

### 页面可见性

v0.1.0 没有每页面读取 ACL。`publicMode` 只全局控制匿名读取，`protectionLevel` 只控制写入。

搜索、分类和维护发现查询会明确筛选 `status = published` 和未删除页面。但直接条目/历史界面及 JSON 页面资源路径范围更宽：

- 具有 `page.read` 时，`GET /api/v1/pages` 会列出未删除草稿和已归档页面，除非用 `status` 缩小范围。
- `GET /api/v1/pages/{id}` 和修订读取辅助函数会拒绝已删除页面，但目前允许草稿/已归档页面记录。
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

- 专用媒体库/API 和应用提供的媒体字节要求 `media.read`，但它不是通用元数据边界：新建/编辑页面只凭 `page.create`/`page.edit` 就会列出资源，`/admin/media` 只凭 `site.configure` 就会列出资源，最近更改信息流也可能凭 `page.read` 暴露媒体标签/URL。
- 上传要求 `media.upload`。
- 删除要求 `media.delete`。
- 上传时不会把媒体关联到页面。引用发现只是对当前已发布修订 Markdown 执行不区分大小写的子字符串扫描，查找已存 `publicUrl` 或安全文件名；它不解析 Markdown，也不搜索 `storageKey`。它可能产生误报或漏报，包括漏掉推荐的 S3 `/media/{storageKey}` 形式。
- 只有该启发式扫描找到引用时，删除才会返回冲突；显式强制路径会绕过冲突。不要把它视为引用完整性，或不会删除使用中资源的保证。
- 会执行大小和 MIME 允许列表检查，但字节检测失败时，校验器目前会回退到客户端声明的 MIME 类型。不要把扩展名或声明类型当作文件内容证明。
- 已授权的本地媒体响应目前使用为期一年的 `public, immutable` 缓存策略。私有部署必须禁用代理/CDN 共享缓存。若要让退出登录、移除权限、切换私有模式或删除立即撤销访问，必须把媒体路由改为 `Cache-Control: private, no-store`，并清除已缓存对象或轮换此前分发的 URL。
- 使用 S3 时，已授权的 `/media/{storageKey}` 请求会重定向到有效期一小时的预签名 URL。该 URL 一经签发，在到期前就是 Bearer 凭据；退出登录、用户组变更和私有模式变更都不会撤销它。上传会持久化这个有时限的签名 `publicUrl`，当前媒体选择器/编辑器路径可能复制或插入它。用于行内图片时，重定向还会与默认 `img-src 'self' data: blob:` 策略冲突，因为最终 S3 URL 跨源。

### 会话与 CSRF 边界

受支持的账户和表单流程使用同源浏览器/服务器操作边界。v0.1.0 的 `/api/v1` 没有稳定的跨域、API 密钥或 API Token 契约。使用 Cookie 身份验证的 JSON 写操作必须保持同源，并限于受信任的应用集成；不要把资源路由描述为第三方身份验证 API。

`assertCsrf` 已定义，但目前没有调用点。使用 Cookie 身份验证的 `/api/v1` 变更操作和 `POST /logout` 不校验 `Origin`，也不要求 `x-csrf-token`；当前浏览器层缓解措施是 `SameSite=Lax`。因此，同源使用属于运维限制，而不是应用强制执行的 API 契约。

同源并不能替代完整的操作验证。在完成路由操作验证和最小化响应 DTO 之前，包含不受信任账户的部署不得依赖 `/api/v1` 作为通用或多租户授权边界。

### 敏感响应数据

`/api/v1/me` 返回活跃会话的完整用户行，其中包括 `passwordHash`、规范化用户名/邮箱字段和其他内部列，并附带原始 `csrfToken`。`/api/v1/admin/users` 会向拥有 `user.read` 的调用方返回包含 `passwordHash` 的完整用户行。这些属于应用内部结构，不是稳定、最小化的公开 DTO。只能在同源受信任场景使用；请求/响应日志和下游消费者必须通过允许列表使用所需字段，不得记录或转发原始响应体。

### 审计预期与当前行为

许多特权服务会写入带操作、目标、操作者归属、详情和时间戳的结构化审计事件，但并非所有用户/用户组管理路径都已完整覆盖。Schema 也支持请求 ID、哈希 IP 和 User-Agent。大多数当前服务调用点没有传入这些请求元数据字段，因此它们通常为 null。

审计详情绝不能包含密码、会话/CSRF Token、原始 Cookie、密码/重置 Token 或完整页面正文。`src/lib/logger.ts` 当前只配置 Pino，并未提供完整的字段脱敏层；每个日志调用和下游接收端都必须通过显式允许列表限定为运维事件所需字段。

### 备份权限与 Owner 恢复

RBAC 中存在 `backup.create`，并授予 Administrator/Owner，但 `pnpm backup` 和 `pnpm restore` 是操作系统 CLI 命令，不会验证应用操作者。必须通过部署权限控制这些命令、数据库、存储和备份目录的访问。

至少保留两个活跃 Owner 账户。如果数据库没有任何用户记录，未认证的 Owner 专用设置路径就是受支持的引导方式，并会保留现有站点/内容记录。如果仍有任意用户记录但没有可用的活跃 Owner，则不存在受支持的 Owner 恢复操作或脚本；恢复需要受控数据库干预，修复用户状态和 `Owners` 用户组关系。生产使用前应测试并记录站点专用恢复手册，先进行备份，并在外部审计此次干预。

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
