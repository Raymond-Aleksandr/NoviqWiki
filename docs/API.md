# NoviqWiki API

> [English](API.md) | [简体中文](API.md#简体中文)

NoviqWiki v0.1.0 exposes JSON resource routes under `/api/v1` and operational probes under `/api`. Initial setup, zero-user Owner bootstrap, login, logout, registration, password reset, and email verification are browser page/server-action flows; there is no JSON login endpoint, API key, or bearer-token flow in this release.

## Generate the OpenAPI Route Index

```bash
pnpm openapi
```

The command rewrites `docs/openapi.json` from the manually curated route index in `scripts/generate-openapi.ts`. It does not currently contain complete schemas, security definitions, query parameters, error responses, or every implemented operation, so use this document and the route handlers together when integrating.

## Base URL and Authentication

Example base URL:

```text
https://wiki.example.com/api/v1
```

Authentication uses the same database-backed browser session as the web UI. `/api/v1` does not accept `Authorization: Bearer ...` and has no stable cross-origin, API-key, or API-token contract in v0.1.0. Keep API use same-origin and limited to trusted application integrations; use the supported browser/server-action flows for login and account recovery.

This restriction is operational guidance, not a separate API isolation boundary. Until route-operation validation and minimized response DTOs are completed, deployments with untrusted user accounts must not treat `/api/v1` as a general-purpose, multi-tenant, or third-party API.

`GET /api/v1/me` returns current session context for the trusted application UI. Its response shape is internal and is not a stable public identity DTO.

## Response Conventions

Successful JSON responses are wrapped in `data`:

```json
{
  "data": {
    "status": "ok"
  }
}
```

Successful deletes return `204 No Content`. Media upload accepts `multipart/form-data`; other mutation endpoints accept JSON.

Errors use this shape. Validation errors and some application errors also include `details`.

```json
{
  "error": {
    "code": "forbidden",
    "message": "You do not have permission to perform this action.",
    "details": {}
  }
}
```

API error messages use this exact locale order: a valid `noviqwiki-locale` cookie; the locale of the active session user; Simplified Chinese when the raw `Accept-Language` value contains `zh` case-insensitively; otherwise English. The current check does not interpret language weights, and API errors do not consult the site's default locale. Integrations should branch on the stable `code`, not the translated `message`.

Current status behavior:

| Status | Meaning                                                                                                                 |
| ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `400`  | An application error explicitly classified as a bad request.                                                            |
| `403`  | Setup, authentication, or the required permission is missing. Current API authentication failures use `403`, not `401`. |
| `404`  | The resource was not found or was hidden as not found.                                                                  |
| `409`  | A duplicate, stale edit, invalid lifecycle transition, cross-page diff, or similar conflict.                            |
| `413`  | A media upload exceeds the configured size limit.                                                                       |
| `415`  | The selected media MIME type is not allowed.                                                                            |
| `422`  | Zod body validation failed or an upload field/value is invalid.                                                         |
| `500`  | An unhandled error, including malformed input that was not validated at the route boundary.                             |

JSON bodies use Zod in the implemented mutation routes. Query strings and route parameters are not consistently schema-validated in v0.1.0; clients should send documented enum values, UUIDs, and positive pagination integers.

## Endpoint Summary

| Endpoint                          | Required permission                                | Notes                                                      |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `GET /me`                         | None                                               | Returns a full user row and CSRF token; see the warning.   |
| `GET /pages`                      | `page.read`                                        | Lists non-deleted pages; see the visibility warning below. |
| `POST /pages`                     | `page.create`; also `page.publish` when publishing | Creates a draft or a published page.                       |
| `GET /pages/{id}`                 | `page.read`                                        | Returns a page and its current revision.                   |
| `PATCH /pages/{id}`               | Depends on the selected operation                  | Archive, restore, protect, rename, or publish.             |
| `DELETE /pages/{id}`              | `page.delete`                                      | Soft-deletes the page.                                     |
| `POST /pages/{id}/rollback`       | `page.rollback`                                    | Creates a new published revision from an older revision.   |
| `GET /pages/{id}/revisions`       | `revision.read`                                    | Lists immutable revisions.                                 |
| `GET /pages/{id}/backlinks`       | `page.read`                                        | Returns up to 100 published backlinks.                     |
| `GET /revisions/{id}`             | `revision.read`                                    | Returns one stored revision.                               |
| `GET /revisions/{from}/diff/{to}` | `revision.read`                                    | Requires both revisions to belong to the same page.        |
| `GET /search`                     | `page.read`                                        | Searches published, non-deleted pages.                     |
| `GET /categories`                 | `page.read`                                        | Lists categories derived from published pages.             |
| `GET /categories/{slug}`          | `page.read`                                        | Returns a category and its published pages.                |
| `GET /media`                      | `media.read`                                       | Lists non-deleted media assets.                            |
| `POST /media`                     | `media.upload`                                     | Uploads one file.                                          |
| `GET /media/{id}`                 | `media.read`                                       | Returns published-page references to an asset.             |
| `DELETE /media/{id}`              | `media.delete`                                     | Deletes an unreferenced asset, or uses `force=true`.       |
| `GET /admin/users`                | `user.read`                                        | Searches and returns full internal user rows.              |
| `PATCH /admin/users/{id}`         | `user.manage`                                      | Replaces group memberships.                                |
| `GET /admin/groups`               | `group.read`                                       | Lists groups and assigned roles.                           |
| `POST /admin/groups`              | `group.manage`                                     | Creates a group and optionally assigns roles.              |
| `PATCH /admin/groups/{id}`        | `group.manage`                                     | Updates a group and replaces assigned roles.               |
| `GET /admin/roles`                | `role.read`                                        | Lists roles and permissions.                               |
| `POST /admin/roles`               | `role.manage`                                      | Creates a custom role.                                     |
| `PATCH /admin/roles/{id}`         | `role.manage`                                      | Updates a custom role; built-in roles are immutable.       |
| `GET /admin/audit`                | `audit.read`                                       | Filters and paginates audit events.                        |

Permissions are evaluated server-side. A protected page additionally requires `page.protect` for draft saving, publication, rename, rollback, delete, archive, or restore in the shared page service.

## Current User

```http
GET /api/v1/me
```

`GET /api/v1/me` requires no permission. Without an active session it returns `user: null` and `csrfToken: null`. With an active session, `user` is the complete persisted `users` row, including `passwordHash`, `normalizedUsername`, `normalizedEmail`, the original username and email, status, locale, appearance, verification/login timestamps, and creation/update timestamps. The response also contains the session's raw `csrfToken`.

`GET /api/v1/admin/users` requires `user.read` and returns up to 100 complete `users` rows with the same internal fields, including `passwordHash` and both normalized identifiers; it does not add a CSRF token. These are current implementation facts, not merely fields that might appear.

Neither response is a stable, minimized public DTO. Restrict both endpoints to same-origin trusted use. Treat password hashes and CSRF tokens as secrets: logs and downstream systems must record only an explicit allowlist of required fields and must not store or forward raw responses.

## Pages

### List pages

```http
GET /api/v1/pages?q=term&status=published&page=1&pageSize=50
```

Supported query parameters are `q`, `status`, `page`, and `pageSize`. `status` should be one of `draft`, `published`, `archived`, or `deleted`. The list service always excludes rows with `deletedAt`, so `status=deleted` currently returns no deleted rows. The response is `{ "pages": [...] }`; this endpoint does not return a total count.

Visibility limitation: with `page.read`, the current implementation lists draft and archived page records unless `status` narrows the result. `GET /pages/{id}` similarly rejects deleted pages but does not restrict draft or archived pages. Therefore, the v0.1.0 page resource API is not a published-content-only API. Do not expose it to anonymous public-wiki clients if draft titles or archived content are sensitive. `/search`, categories, and maintenance listings provide published-only discovery, but a known archived slug can still resolve through the direct article and history UI; do not use archival status as a confidentiality boundary.

### Create a page

```http
POST /api/v1/pages
Content-Type: application/json
```

```json
{
  "title": "Getting Started",
  "slug": "getting-started",
  "markdown": "# Getting Started",
  "editSummary": "Initial content",
  "publish": false
}
```

`slug` and `editSummary` are optional; `markdown` defaults to an empty string and `publish` defaults to `false`. A draft response contains `{ page, draft }`; a published response contains `{ page, revision }`.

### Read, change, or delete a page

```http
GET /api/v1/pages/{id}
PATCH /api/v1/pages/{id}
DELETE /api/v1/pages/{id}
```

Use one logical PATCH operation per request. The handler evaluates fields in this order: `action`, `protectionLevel`, `title`, then `markdown`.

The current permission checks are:

| Selected PATCH operation | Route permissions              | Additional check for an already protected page |
| ------------------------ | ------------------------------ | ---------------------------------------------- |
| `action: "archive"`      | `page.delete`                  | `page.protect`                                 |
| `action: "restore"`      | `page.restore`                 | `page.protect`                                 |
| `protectionLevel`        | `page.protect`                 | None beyond `page.protect`                     |
| `title` rename           | `page.edit` and `page.rename`  | `page.protect`                                 |
| `markdown` publication   | `page.edit` and `page.publish` | `page.protect`                                 |

The PATCH schema does not enforce exactly one logical operation. A body containing several documented operations is accepted, and only the first matching branch in the order above runs; lower-priority operation fields are ignored.

An empty `{}` body is also accepted. After requiring only an active session, the handler falls through to `getPageWithCurrentRevision` without checking `page.read` or applying the normal page-visibility assertion. Any active user who knows a page UUID can therefore retrieve the complete page row and current revision through empty PATCH, including a deleted page. This is a known authorization and data-exposure vulnerability. Do not send empty or combined PATCH bodies, and keep `/api/v1` trusted-only until the server rejects them before reading a page.

Archive or restore:

```json
{ "action": "archive" }
```

```json
{ "action": "restore" }
```

Protect or unprotect:

```json
{ "protectionLevel": "protected" }
```

```json
{ "protectionLevel": "none" }
```

Rename and optionally replace the slug:

```json
{
  "title": "Installation Guide",
  "slug": "installation-guide"
}
```

The API rename path always preserves the old slug as an alias when possible.

Publish Markdown with optimistic concurrency:

```json
{
  "markdown": "# Updated content",
  "editSummary": "Clarify setup",
  "baseRevisionId": "00000000-0000-0000-0000-000000000000"
}
```

Sending `markdown` through PATCH always publishes; there is no JSON draft-save operation. `baseRevisionId` may be `null` for the first publication and must match the current revision for later publications.

### Rollback, revisions, and backlinks

```http
POST /api/v1/pages/{id}/rollback
GET /api/v1/pages/{id}/revisions
GET /api/v1/pages/{id}/backlinks
```

Rollback body:

```json
{
  "targetRevisionId": "00000000-0000-0000-0000-000000000000",
  "reason": "Restore verified content"
}
```

Rollback never mutates the target revision; it creates a new published revision. Backlinks contain published, non-deleted source pages that link to the requested page through the current stored link projection.

## Revisions and Diff

```http
GET /api/v1/revisions/{id}
GET /api/v1/revisions/{from}/diff/{to}
```

Revision reads return stored immutable revision data. Diff returns both stored revisions, a unified patch string, parsed unified lines, and side-by-side rows generated from their Markdown. A comparison of revisions from different pages returns `409`.

## Search

```http
GET /api/v1/search?q=term&category=docs&page=1&pageSize=20
```

The supported pagination parameters are `page` and `pageSize`; `limit` and `offset` are not API query parameters. Search uses PostgreSQL full-text search plus prefix and case-insensitive substring fallbacks over titles, aliases, rendered plain text, and category names. An empty `q` returns no rows. When supplied, `category` must exactly equal the stored, case-sensitive category `slug`; it is not a display name or fuzzy category query. Obtain the value from `GET /categories`. The result is `{ "rows": [...], "count": number }`.

## Categories

```http
GET /api/v1/categories
GET /api/v1/categories/{slug}
```

Category lists and detail pages include published, non-deleted page associations. The `{slug}` route parameter is an exact, case-sensitive stored slug; use the `slug` returned by `GET /categories`, not the category display name.

## Media

```http
GET /api/v1/media?q=diagram&page=1&pageSize=50
POST /api/v1/media
GET /api/v1/media/{id}
DELETE /api/v1/media/{id}
DELETE /api/v1/media/{id}?force=true
```

Upload fields:

- `file` (required)
- `altText` (optional)

Example:

```bash
curl --cookie cookies.txt \
  -F 'file=@architecture.png' \
  -F 'altText=Architecture diagram' \
  https://wiki.example.com/api/v1/media
```

Uploads are checked against the site size and MIME allowlists and stored through the runtime adapter selected by `NOVIQWIKI_MEDIA_DRIVER`. The detector currently falls back to the client-declared MIME type when `file-type` cannot identify the bytes; deployers should keep a narrow allowlist and should not treat v0.1.0 upload inspection as complete content validation.

`GET /media/{id}` returns `{ "references": [...] }`, not the binary file. Local storage persists a durable application URL.

With S3, an upload creates a signed GET URL valid for one hour and persists that exact URL in `media_assets.publicUrl`. Upload/list responses and the current editor and media-library flows reuse the stored value; they do not renew it on read. Database rows and Markdown can therefore retain an expired URL. A signed URL is a bearer capability: direct S3 requests do not recheck the NoviqWiki session or `media.read` permission before the signature expires.

The same-origin `/media/{storageKey}` application route does check `media.read` and creates a fresh signed URL, but then redirects the browser to the S3 endpoint. The current CSP allows images only from `'self'`, `data:`, and `blob:`. Direct or redirected images on an external S3 origin are therefore blocked unless the deployment changes the CSP to allow that origin. Under the current defaults, the route is not by itself a fully working durable S3 embedding path.

Reference reporting and the non-force deletion guard use a heuristic scan. They inspect only the current revisions of published, non-deleted pages and perform case-insensitive substring matches for the persisted `publicUrl` or `safeFilename`. They do not inspect drafts, archived or deleted pages, historical revisions, or `storageKey`/same-origin references that omit both stored strings; a filename appearing as unrelated text can also be a false positive. Deletion returns `409` only when this scan finds a match, and `force=true` bypasses it. Treat the reference list as incomplete rather than an authoritative dependency graph.

## Administration

```http
GET /api/v1/admin/users?q=alice
PATCH /api/v1/admin/users/{id}
GET /api/v1/admin/groups
POST /api/v1/admin/groups
PATCH /api/v1/admin/groups/{id}
GET /api/v1/admin/roles
POST /api/v1/admin/roles
PATCH /api/v1/admin/roles/{id}
GET /api/v1/admin/audit?q=term&action=page.published&page=1&pageSize=50
```

User membership body:

```json
{ "groupIds": ["00000000-0000-0000-0000-000000000000"] }
```

Group create/update bodies use `name`, optional `description`, and `roleIds`. Role create/update bodies use `name`, optional `description`, and `permissionKeys`. Built-in roles cannot be updated.

`GET /admin/audit` supports `q`, `action`, `page`, and `pageSize`; `pageSize` is clamped to `1..100`. User creation, status changes, and session resets remain server-action-backed UI operations rather than JSON routes.

## Operational Endpoints

```http
GET /api/health
GET /api/ready
```

`/api/health` returns `{"data":{"status":"ok"}}`. `/api/ready` executes a database query and asks the storage adapter for readiness. Local storage readiness creates/checks the configured directory. S3 readiness currently checks only that a bucket name is configured; it does not make a network connectivity request.

---

## 简体中文

> [English](API.md) | [简体中文](API.md#简体中文)

NoviqWiki v0.1.0 在 `/api/v1` 下提供 JSON 资源路由，并在 `/api` 下提供运行探针。初始设置、零用户 Owner 引导、登录、退出、注册、密码重置和邮箱验证通过浏览器页面及服务器操作完成；此版本没有 JSON 登录端点、API 密钥或 Bearer Token 流程。

### 生成 OpenAPI 路由索引

```bash
pnpm openapi
```

该命令会根据 `scripts/generate-openapi.ts` 中人工维护的精简路由索引重写 `docs/openapi.json`。它目前没有包含完整的 Schema、安全定义、查询参数、错误响应或所有已实现操作。进行集成时，应同时参考本文档和实际路由处理器。

### 基础地址与身份验证

基础地址示例：

```text
https://wiki.example.com/api/v1
```

API 使用与网页界面相同的数据库会话。`/api/v1` 不接受 `Authorization: Bearer ...`，而且 v0.1.0 没有稳定的跨域、API 密钥或 API Token 契约。API 只能保持同源，并限于受信任的应用集成；登录和账户恢复应使用受支持的浏览器/服务器操作流程。

这一限制属于运维指导，并不构成独立的 API 隔离边界。在完成路由操作验证和最小化响应 DTO 之前，包含不受信任用户账户的部署不得把 `/api/v1` 当作通用、多租户或第三方 API。

`GET /api/v1/me` 为受信任应用 UI 返回当前会话上下文。其响应结构属于内部实现，不是稳定的公开身份 DTO。

### 响应约定

成功的 JSON 响应统一包在 `data` 中：

```json
{
  "data": {
    "status": "ok"
  }
}
```

成功删除返回 `204 No Content`。媒体上传接受 `multipart/form-data`；其他写操作端点接受 JSON。

错误使用以下结构。校验错误和部分应用错误还会包含 `details`。

```json
{
  "error": {
    "code": "forbidden",
    "message": "You do not have permission to perform this action.",
    "details": {}
  }
}
```

API 错误消息严格按以下顺序选择语言：有效的 `noviqwiki-locale` Cookie；活跃会话用户的语言；原始 `Accept-Language` 值不区分大小写包含 `zh` 时使用简体中文；否则使用英文。当前检查不会解释语言权重，API 错误也不会查询站点默认语言。集成程序应依据稳定的 `code` 分支处理，不应依据已翻译的 `message`。

当前状态码行为：

| 状态码 | 含义                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- |
| `400`  | 应用错误被明确归类为错误请求。                                                                |
| `403`  | 尚未完成设置、没有身份验证，或缺少所需权限。当前 API 的身份验证失败使用 `403`，而不是 `401`。 |
| `404`  | 资源不存在，或为了隐藏资源而按不存在处理。                                                    |
| `409`  | 重复资源、过期编辑、非法生命周期转换、跨页面差异比较等冲突。                                  |
| `413`  | 媒体上传超过配置的大小限制。                                                                  |
| `415`  | 所选媒体 MIME 类型不在允许列表中。                                                            |
| `422`  | Zod 请求体验证失败，或上传字段/值无效。                                                       |
| `500`  | 未处理错误，包括路由边界没有校验的畸形输入。                                                  |

已实现的写操作路由使用 Zod 校验 JSON 请求体。v0.1.0 尚未统一用 Schema 校验查询字符串和路由参数；客户端应发送文档列出的枚举值、UUID 和正整数分页参数。

### 端点总览

| 端点                              | 所需权限                                 | 说明                                      |
| --------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `GET /me`                         | 无                                       | 返回完整用户行和 CSRF Token；见下方警告。 |
| `GET /pages`                      | `page.read`                              | 列出未删除页面；请阅读下方可见性警告。    |
| `POST /pages`                     | `page.create`；发布时还需 `page.publish` | 创建草稿或已发布页面。                    |
| `GET /pages/{id}`                 | `page.read`                              | 返回页面及当前修订。                      |
| `PATCH /pages/{id}`               | 取决于所选操作                           | 归档、恢复、保护、重命名或发布。          |
| `DELETE /pages/{id}`              | `page.delete`                            | 软删除页面。                              |
| `POST /pages/{id}/rollback`       | `page.rollback`                          | 从旧修订创建新的已发布修订。              |
| `GET /pages/{id}/revisions`       | `revision.read`                          | 列出不可变修订。                          |
| `GET /pages/{id}/backlinks`       | `page.read`                              | 最多返回 100 个已发布反向链接。           |
| `GET /revisions/{id}`             | `revision.read`                          | 返回一个已存储修订。                      |
| `GET /revisions/{from}/diff/{to}` | `revision.read`                          | 两个修订必须属于同一页面。                |
| `GET /search`                     | `page.read`                              | 搜索已发布且未删除的页面。                |
| `GET /categories`                 | `page.read`                              | 列出从已发布页面派生的分类。              |
| `GET /categories/{slug}`          | `page.read`                              | 返回分类及其已发布页面。                  |
| `GET /media`                      | `media.read`                             | 列出未删除媒体资源。                      |
| `POST /media`                     | `media.upload`                           | 上传一个文件。                            |
| `GET /media/{id}`                 | `media.read`                             | 返回引用该资源的已发布页面。              |
| `DELETE /media/{id}`              | `media.delete`                           | 删除未被引用的资源，或使用 `force=true`。 |
| `GET /admin/users`                | `user.read`                              | 搜索并返回完整内部用户行。                |
| `PATCH /admin/users/{id}`         | `user.manage`                            | 替换用户的用户组成员关系。                |
| `GET /admin/groups`               | `group.read`                             | 列出用户组及分配的角色。                  |
| `POST /admin/groups`              | `group.manage`                           | 创建用户组并可选分配角色。                |
| `PATCH /admin/groups/{id}`        | `group.manage`                           | 更新用户组并替换已分配角色。              |
| `GET /admin/roles`                | `role.read`                              | 列出角色及权限。                          |
| `POST /admin/roles`               | `role.manage`                            | 创建自定义角色。                          |
| `PATCH /admin/roles/{id}`         | `role.manage`                            | 更新自定义角色；内置角色不可修改。        |
| `GET /admin/audit`                | `audit.read`                             | 筛选并分页查看审计事件。                  |

权限在服务器端计算。对于受保护页面，通过共享页面服务保存草稿、发布、重命名、回滚、删除、归档或恢复时，还需要 `page.protect`。

### 当前用户

```http
GET /api/v1/me
```

`GET /api/v1/me` 不要求权限。没有活跃会话时，它返回 `user: null` 和 `csrfToken: null`。存在活跃会话时，`user` 是完整持久化 `users` 行，包括 `passwordHash`、`normalizedUsername`、`normalizedEmail`、原始用户名和邮箱、状态、语言、外观、验证/登录时间戳以及创建/更新时间戳。响应还包含当前会话的原始 `csrfToken`。

`GET /api/v1/admin/users` 要求 `user.read`，最多返回 100 个完整 `users` 行，包含相同的内部字段，包括 `passwordHash` 和两个规范化标识符；它不会额外返回 CSRF Token。这些是当前实现确定会返回的内容，不是“可能出现”的字段。

两种响应都不是稳定、最小化的公开 DTO。只能在同源受信任场景使用。密码哈希和 CSRF Token 必须作为密钥处理：日志和下游系统只能通过明确允许列表记录所需字段，不得存储或转发原始响应。

### 页面

#### 列出页面

```http
GET /api/v1/pages?q=term&status=published&page=1&pageSize=50
```

支持的查询参数为 `q`、`status`、`page` 和 `pageSize`。`status` 应为 `draft`、`published`、`archived` 或 `deleted` 之一。列表服务始终排除带 `deletedAt` 的记录，因此 `status=deleted` 目前不会返回已删除记录。响应为 `{ "pages": [...] }`；该端点不返回总数。

可见性限制：拥有 `page.read` 时，当前实现会列出草稿和已归档页面记录，除非用 `status` 缩小范围。`GET /pages/{id}` 同样只拒绝已删除页面，并不会限制草稿或已归档页面。因此，v0.1.0 的页面资源 API 不是“仅已发布内容”API。如果草稿标题或归档内容属于敏感信息，不要把它暴露给公开 Wiki 的匿名客户端。`/search`、分类和维护列表只发现已发布内容，但已知的归档页面 slug 仍可通过直接条目与历史界面解析；不要把归档状态当作保密边界。

#### 创建页面

```http
POST /api/v1/pages
Content-Type: application/json
```

```json
{
  "title": "Getting Started",
  "slug": "getting-started",
  "markdown": "# Getting Started",
  "editSummary": "Initial content",
  "publish": false
}
```

`slug` 和 `editSummary` 可省略；`markdown` 默认为空字符串，`publish` 默认为 `false`。草稿响应包含 `{ page, draft }`；发布响应包含 `{ page, revision }`。

#### 读取、更改或删除页面

```http
GET /api/v1/pages/{id}
PATCH /api/v1/pages/{id}
DELETE /api/v1/pages/{id}
```

每次请求只应执行一个逻辑 PATCH 操作。处理器按以下顺序判断字段：`action`、`protectionLevel`、`title`、`markdown`。

当前权限检查如下：

| 选中的 PATCH 操作   | 路由权限                      | 页面已经受保护时的额外检查 |
| ------------------- | ----------------------------- | -------------------------- |
| `action: "archive"` | `page.delete`                 | `page.protect`             |
| `action: "restore"` | `page.restore`                | `page.protect`             |
| `protectionLevel`   | `page.protect`                | 除 `page.protect` 外无其他 |
| `title` 重命名      | `page.edit` 和 `page.rename`  | `page.protect`             |
| `markdown` 发布     | `page.edit` 和 `page.publish` | `page.protect`             |

PATCH Schema 不会强制只能有一个逻辑操作。包含多个已记录操作的请求体会通过校验，并且只执行上述顺序中的第一个匹配分支；优先级较低的操作字段会被忽略。

空的 `{}` 请求体同样会通过校验。处理器只要求存在活跃会话，随后就会回退调用 `getPageWithCurrentRevision`，既不检查 `page.read`，也不执行正常的页面可见性断言。因此，任何知道页面 UUID 的活跃用户都能通过空 PATCH 读取完整页面行和当前修订，包括已删除页面。这是已知的授权和数据暴露漏洞。在服务器能于读取页面前拒绝这些请求体之前，不要发送空或组合 PATCH 请求，并将 `/api/v1` 限于受信任场景。

归档或恢复：

```json
{ "action": "archive" }
```

```json
{ "action": "restore" }
```

保护或取消保护：

```json
{ "protectionLevel": "protected" }
```

```json
{ "protectionLevel": "none" }
```

重命名并可选替换路径名：

```json
{
  "title": "Installation Guide",
  "slug": "installation-guide"
}
```

在可能的情况下，API 重命名路径总会把旧路径名保留为别名。

使用乐观并发控制发布 Markdown：

```json
{
  "markdown": "# Updated content",
  "editSummary": "Clarify setup",
  "baseRevisionId": "00000000-0000-0000-0000-000000000000"
}
```

通过 PATCH 发送 `markdown` 一定会发布；没有 JSON 草稿保存操作。首次发布时 `baseRevisionId` 可以为 `null`，后续发布时必须与当前修订一致。

#### 回滚、修订和反向链接

```http
POST /api/v1/pages/{id}/rollback
GET /api/v1/pages/{id}/revisions
GET /api/v1/pages/{id}/backlinks
```

回滚请求体：

```json
{
  "targetRevisionId": "00000000-0000-0000-0000-000000000000",
  "reason": "Restore verified content"
}
```

回滚不会修改目标修订，而是创建新的已发布修订。反向链接包含通过当前已存储链接投影指向目标页面的已发布、未删除来源页面。

### 修订与差异比较

```http
GET /api/v1/revisions/{id}
GET /api/v1/revisions/{from}/diff/{to}
```

修订读取会返回已存储的不可变修订数据。差异响应包含两个已存储修订、统一补丁字符串、解析后的统一差异行，以及根据 Markdown 生成的并排差异行。比较不同页面的修订会返回 `409`。

### 搜索

```http
GET /api/v1/search?q=term&category=docs&page=1&pageSize=20
```

支持的分页参数是 `page` 和 `pageSize`；`limit` 和 `offset` 不是 API 查询参数。搜索使用 PostgreSQL 全文搜索，并以标题、别名、渲染纯文本和分类名称上的前缀匹配及不区分大小写子字符串匹配作为回退。空的 `q` 不返回结果。提供 `category` 时，它必须与已存储且区分大小写的分类 `slug` 完全相等；它不是显示名称或模糊分类查询。应从 `GET /categories` 获取该值。结果结构为 `{ "rows": [...], "count": number }`。

### 分类

```http
GET /api/v1/categories
GET /api/v1/categories/{slug}
```

分类列表和详情只包含已发布、未删除页面的关联关系。`{slug}` 路由参数是区分大小写的已存储精确 slug；应使用 `GET /categories` 返回的 `slug`，而不是分类显示名称。

### 媒体

```http
GET /api/v1/media?q=diagram&page=1&pageSize=50
POST /api/v1/media
GET /api/v1/media/{id}
DELETE /api/v1/media/{id}
DELETE /api/v1/media/{id}?force=true
```

上传字段：

- `file`（必填）
- `altText`（可选）

示例：

```bash
curl --cookie cookies.txt \
  -F 'file=@architecture.png' \
  -F 'altText=Architecture diagram' \
  https://wiki.example.com/api/v1/media
```

上传会根据站点大小限制和 MIME 允许列表检查，并通过 `NOVIQWIKI_MEDIA_DRIVER` 选择的运行时适配器存储。当 `file-type` 无法识别字节内容时，当前检测器会回退到客户端声明的 MIME 类型；部署者应维持严格的允许列表，不应把 v0.1.0 的上传检查视为完整内容验证。

`GET /media/{id}` 返回 `{ "references": [...] }`，而不是文件二进制。本地存储会保存持久的应用地址。

使用 S3 时，上传会创建有效期一小时的签名 GET URL，并把该准确 URL 持久化到 `media_assets.publicUrl`。上传/列表响应以及当前编辑器和媒体库流程会复用已保存值，不会在读取时续期。因此，数据库行和 Markdown 可能长期保留已经过期的 URL。签名 URL 属于持有即授权的能力：签名过期前，直接 S3 请求不会重新检查 NoviqWiki 会话或 `media.read` 权限。

同源 `/media/{storageKey}` 应用路由会检查 `media.read` 并创建新的签名 URL，但随后会把浏览器重定向到 S3 端点。当前 CSP 只允许从 `'self'`、`data:` 和 `blob:` 加载图片。因此，除非部署修改 CSP 以允许对应来源，否则外部 S3 来源上的直接或重定向图片都会被阻止。在当前默认值下，该路由本身并不是完整可用的持久 S3 嵌入路径。

引用报告和非强制删除保护使用启发式扫描。它们只检查已发布、未删除页面的当前修订，并对持久化的 `publicUrl` 或 `safeFilename` 执行不区分大小写的子字符串匹配。它们不会检查草稿、已归档或已删除页面、历史修订，也不会检查同时省略这两个已存储字符串的 `storageKey`/同源引用；文件名作为无关文本出现时也可能产生误报。只有该扫描找到匹配时，删除才返回 `409`；`force=true` 会绕过扫描。引用列表并不是权威依赖图，应视为不完整结果。

### 管理

```http
GET /api/v1/admin/users?q=alice
PATCH /api/v1/admin/users/{id}
GET /api/v1/admin/groups
POST /api/v1/admin/groups
PATCH /api/v1/admin/groups/{id}
GET /api/v1/admin/roles
POST /api/v1/admin/roles
PATCH /api/v1/admin/roles/{id}
GET /api/v1/admin/audit?q=term&action=page.published&page=1&pageSize=50
```

用户成员关系请求体：

```json
{ "groupIds": ["00000000-0000-0000-0000-000000000000"] }
```

创建/更新用户组的请求体使用 `name`、可选的 `description` 和 `roleIds`。创建/更新角色的请求体使用 `name`、可选的 `description` 和 `permissionKeys`。内置角色不可更新。

`GET /admin/audit` 支持 `q`、`action`、`page` 和 `pageSize`；`pageSize` 会限制在 `1..100`。用户创建、状态变更和会话重置仍通过服务器操作支持的管理界面完成，而不是 JSON 路由。

### 运行探针

```http
GET /api/health
GET /api/ready
```

`/api/health` 返回 `{"data":{"status":"ok"}}`。`/api/ready` 会执行数据库查询，并向存储适配器询问就绪状态。本地存储就绪检查会创建/检查配置目录。S3 就绪检查目前只确认已配置存储桶名称，不会发起网络连通性请求。
