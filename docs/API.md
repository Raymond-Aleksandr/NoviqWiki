# NoviqWiki API

> [English](API.md) | [简体中文](API.md#简体中文)

NoviqWiki v0.1.0 exposes JSON resource routes under `/api/v1` and operational probes under `/api`. Initial setup, Owner recovery/bootstrap when a site has no active Owner, login, logout, registration, password reset, email verification, and verification-email resend are browser page/server-action flows; there is no JSON login endpoint, API key, or bearer-token flow in this release. Public recovery requests deliberately return generic responses and perform delivery after the response boundary.

## Generate the OpenAPI Route Index

```bash
pnpm openapi
```

The command rewrites `docs/openapi.json` from the route index in `scripts/generate-openapi.ts`, including request schemas, query parameters, and authentication/CSRF requirements. Use the generated artifact together with this guide when integrating.

## Base URL and Authentication

Example base URL:

```text
https://wiki.example.com/api/v1
```

Authentication uses the same database-backed browser session as the web UI. `/api/v1` does not accept `Authorization: Bearer ...` and has no stable cross-origin, API-key, or API-token contract in v0.1.0. Keep API use same-origin and limited to trusted application integrations; use the supported browser/server-action flows for login and account recovery.

This restriction is operational guidance, not a separate API isolation boundary. Deployments must not treat the cookie-authenticated v0.1 API as a cross-origin or third-party token API.

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

Cookie-authenticated `POST`, `PATCH`, and `DELETE` requests must be same-origin and include the
current CSRF value in `X-CSRF-Token`. Obtain it from `GET /api/v1/me`; the response exposes only
the safe user DTO and CSRF value, never credentials or password hashes.

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

| Status | Meaning                                                                                      |
| ------ | -------------------------------------------------------------------------------------------- |
| `400`  | Invalid request body, query string, or route parameter.                                      |
| `401`  | Authentication is required.                                                                  |
| `403`  | The authenticated user lacks the required permission.                                        |
| `404`  | The resource was not found or was hidden as not found.                                       |
| `409`  | A duplicate, stale edit, invalid lifecycle transition, cross-page diff, or similar conflict. |
| `413`  | A media upload exceeds the configured size limit.                                            |
| `415`  | The selected media MIME type is not allowed.                                                 |
| `422`  | Zod body validation failed or an upload field/value is invalid.                              |
| `429`  | A rate limit was exceeded.                                                                   |
| `500`  | An unhandled server error.                                                                   |

JSON bodies, query strings, and route parameters are validated at the implemented route boundaries. Clients must send documented enum values, UUIDs, bounded strings, and positive pagination integers.

## Endpoint Summary

| Endpoint                          | Required permission                                | Notes                                                      |
| --------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `GET /me`                         | None                                               | Returns a safe user DTO and CSRF token.                    |
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
| `GET /admin/users`                | `user.read`                                        | Searches and returns minimized user DTOs.                  |
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

Returns the current authenticated user or `null` plus the CSRF value required by mutation
requests.

The user object is a minimized DTO and never contains a password hash or normalized credential identifiers. Treat the CSRF token as a secret and do not log or forward it.

## Pages

### List pages

```http
GET /api/v1/pages?q=term&status=published&page=1&pageSize=50
```

Supported query parameters are `q`, `status`, `page`, and `pageSize`. `status` should be one of `draft`, `published`, `archived`, or `deleted`. The list service always excludes rows with `deletedAt`, so `status=deleted` currently returns no deleted rows. The response is `{ "pages": [...] }`; this endpoint does not return a total count.

Page listings default to published content. Draft, archived, or deleted visibility requires the corresponding elevated editing or restore permission. The API delegates visibility and write checks to the same page services as the server-rendered UI.

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

The PATCH schema enforces exactly one logical operation. Empty or mixed-operation bodies are rejected before any page data is read or changed.

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

Uploads use `multipart/form-data` with a required `file` part and optional `altText` of at most 2,000 characters. They are rejected before buffering beyond the configured hard limit, validated using detected safe MIME types, and stored through the runtime adapter selected by `NOVIQWIKI_MEDIA_DRIVER`.

`GET /media/{id}` returns `{ "references": [...] }`, not the binary file. Local storage persists a durable application URL.

Local and S3 media use the same authorized, same-origin streaming route; S3 signatures are never persisted or exposed. Public-site responses use `Cache-Control: public, max-age=0, must-revalidate`, private-site responses use `private, no-store`, and non-inline-safe types download as attachments. `GET /media/{id}` lists references, and deletion is blocked while references exist unless an authorized caller explicitly sends `force=true`.

Reference reporting and the non-force deletion guard inspect current drafts and all immutable revisions, including archived or deleted pages, for exact stored media tokens. Deletion is serialized with page/media writes so a concurrent reference cannot be committed through the check. An authorized `force=true` request explicitly bypasses reference protection.

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

`/api/health` returns `{"data":{"status":"ok"}}`. `/api/ready` executes a database query and asks the active storage adapter to perform a real write/read/delete probe. Local storage rejects unsafe or linked roots before probing; S3 uses the scoped `.noviqwiki-readiness/` prefix and deletes its exact probe object/version.

---

## 简体中文

> [English](API.md) | [简体中文](API.md#简体中文)

NoviqWiki v0.1.0 在 `/api/v1` 下提供 JSON 资源路由，并在 `/api` 下提供运行探针。初始设置、无活跃 Owner 时的恢复/引导、登录、退出、注册、密码重置、邮箱验证及验证邮件重发通过浏览器页面与服务器操作完成；此版本没有 JSON 登录端点、API 密钥或 Bearer Token 流程。

### 生成 OpenAPI 路由索引

```bash
pnpm openapi
```

该命令会根据 `scripts/generate-openapi.ts` 中的路由索引重写 `docs/openapi.json`，其中包含请求 Schema、查询参数以及身份验证/CSRF 要求。进行集成时应同时参考生成制品和本文档。

### 基础地址与身份验证

基础地址示例：

```text
https://wiki.example.com/api/v1
```

API 使用与网页界面相同的数据库会话。`/api/v1` 不接受 `Authorization: Bearer ...`，而且 v0.1.0 没有稳定的跨域、API 密钥或 API Token 契约。API 只能保持同源，并限于受信任的应用集成；登录和账户恢复应使用受支持的浏览器/服务器操作流程。

这一限制属于运维指导，并不构成独立的 API 隔离边界。不得把基于 Cookie 身份验证的 v0.1 API 当作跨域或第三方 Token API。`GET /api/v1/me` 只返回最小化安全用户 DTO 与 CSRF 值，不包含凭据或密码哈希。

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

| 状态码 | 含义                                                         |
| ------ | ------------------------------------------------------------ |
| `400`  | 请求体、查询字符串或路由参数无效。                           |
| `401`  | 需要身份验证。                                               |
| `403`  | 已认证用户缺少所需权限。                                     |
| `404`  | 资源不存在，或为了隐藏资源而按不存在处理。                   |
| `409`  | 重复资源、过期编辑、非法生命周期转换、跨页面差异比较等冲突。 |
| `413`  | 媒体上传超过配置的大小限制。                                 |
| `415`  | 所选媒体 MIME 类型不在允许列表中。                           |
| `422`  | Zod 请求体验证失败，或上传字段/值无效。                      |
| `429`  | 超过限流阈值。                                               |
| `500`  | 未处理的服务器错误。                                         |

已实现的路由会在边界校验 JSON 请求体、查询字符串和路由参数。客户端必须发送文档列出的枚举值、UUID、有界字符串和正整数分页参数。

### 端点总览

| 端点                              | 所需权限                                 | 说明                                      |
| --------------------------------- | ---------------------------------------- | ----------------------------------------- |
| `GET /me`                         | 无                                       | 返回安全用户 DTO 和 CSRF Token。          |
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
| `GET /admin/users`                | `user.read`                              | 搜索并返回最小化用户 DTO。                |
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

`GET /api/v1/me` 不要求权限。没有活跃会话时返回 `user: null` 和 `csrfToken: null`；存在会话时返回最小化用户 DTO 和写请求所需的 CSRF Token。响应不会包含密码哈希或规范化凭据标识符。CSRF Token 必须作为密钥处理，不得记录或转发。

### 页面

#### 列出页面

```http
GET /api/v1/pages?q=term&status=published&page=1&pageSize=50
```

支持的查询参数为 `q`、`status`、`page` 和 `pageSize`。`status` 应为 `draft`、`published`、`archived` 或 `deleted` 之一。列表服务始终排除带 `deletedAt` 的记录，因此 `status=deleted` 目前不会返回已删除记录。响应为 `{ "pages": [...] }`；该端点不返回总数。

页面列表默认只返回已发布内容。查看草稿、已归档或已删除内容需要相应的编辑或恢复权限；API 与服务端渲染界面共用页面服务中的可见性和写入检查。

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

PATCH Schema 强制每次请求只能包含一个逻辑操作；空请求体或混合操作会在读取或修改页面数据前被拒绝。

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

上传使用 `multipart/form-data`，必须包含 `file`，可选 `altText` 最长 2,000 字符。请求会在超过硬限制前被拒绝，并依据检测到的安全 MIME 类型校验后，通过 `NOVIQWIKI_MEDIA_DRIVER` 选择的适配器存储。

`GET /media/{id}` 返回 `{ "references": [...] }`，而不是文件二进制。本地存储会保存持久的应用地址。

本地与 S3 媒体使用同一个经过授权的同源流式路由；S3 签名不会被持久化或暴露。公开站点响应使用 `Cache-Control: public, max-age=0, must-revalidate`，私有站点使用 `private, no-store`；非内联安全类型会作为附件下载。引用检查覆盖当前草稿和所有不可变修订（包括已归档或删除页面），并与页面/媒体写入串行化；存在引用时会阻止普通删除，只有获授权调用者显式使用 `force=true` 才能绕过保护。

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

`/api/health` 返回 `{"data":{"status":"ok"}}`。`/api/ready` 会执行数据库查询，并要求当前存储适配器执行真实的写入/读取/删除探针。本地存储会先拒绝不安全或含链接的根目录；S3 使用受限的 `.noviqwiki-readiness/` 前缀并删除精确探针对象/版本。
