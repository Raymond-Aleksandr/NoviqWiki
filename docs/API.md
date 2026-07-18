# NoviqWiki API

> [English](API.md) | [简体中文](API.md#简体中文)

NoviqWiki v0.1.0 exposes JSON resource routes under `/api/v1` and operational probes under `/api`. First-run setup, login, logout, registration, password reset, and email verification are browser page/server-action flows; there is no JSON login endpoint, API key, or bearer-token flow in this release.

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

Error messages are localized from the locale cookie, active user locale, `Accept-Language`, or site default, depending on request context. Integrations should branch on the stable `code`, not the translated `message`.

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
| `GET /me`                         | None                                               | Returns internal current-session context.                  |
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
| `GET /admin/users`                | `user.read`                                        | Searches users by username/email.                          |
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

This endpoint and `GET /api/v1/admin/users` currently expose internal application response shapes rather than stable, minimized public DTOs and may include sensitive internal account fields. Restrict them to same-origin trusted use. Logs and downstream systems must record only an explicit allowlist of required fields and must not store or forward the raw responses.

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

Empty PATCH bodies and bodies that combine more than one logical operation are unsupported. Send exactly one documented operation shape per request. This client contract is not a substitute for server-side operation validation; keep the resource API trusted-only until unsupported shapes are rejected before any data is returned.

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

The supported pagination parameters are `page` and `pageSize`; `limit` and `offset` are not API query parameters. Search uses PostgreSQL full-text search plus prefix and case-insensitive substring fallbacks over titles, aliases, rendered plain text, and category names. An empty `q` returns no rows. The result is `{ "rows": [...], "count": number }`.

## Categories

```http
GET /api/v1/categories
GET /api/v1/categories/{slug}
```

Category lists and detail pages include published, non-deleted page associations.

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

Uploads are checked against the site size and MIME allowlists and stored through the runtime adapter selected by `NEXTWIKI_MEDIA_DRIVER`. The detector currently falls back to the client-declared MIME type when `file-type` cannot identify the bytes; deployers should keep a narrow allowlist and should not treat v0.1.0 upload inspection as complete content validation.

`GET /media/{id}` returns `{ "references": [...] }`, not the binary file. Local storage returns a durable application URL. With S3, the current adapter can return a time-limited signed `publicUrl`; durable page content should use the same-origin `/media/{storageKey}` application route so authorization and URL renewal happen at read time. Deletion returns `409` while published pages reference the asset unless `force=true` is supplied.

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

NoviqWiki v0.1.0 在 `/api/v1` 下提供 JSON 资源路由，并在 `/api` 下提供运行探针。首次设置、登录、退出、注册、密码重置和邮箱验证通过浏览器页面及服务器操作完成；此版本没有 JSON 登录端点、API 密钥或 Bearer Token 流程。

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

错误消息会根据请求上下文，从语言 Cookie、当前用户语言、`Accept-Language` 或站点默认语言中选择本地化文本。集成程序应依据稳定的 `code` 分支处理，不应依据已翻译的 `message`。

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
| `GET /me`                         | 无                                       | 返回内部当前会话上下文。                  |
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
| `GET /admin/users`                | `user.read`                              | 按用户名/邮箱搜索用户。                   |
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

此端点和 `GET /api/v1/admin/users` 当前暴露的是应用内部响应结构，而不是稳定、最小化的公开 DTO，并可能包含敏感的内部账户字段。只能在同源受信任场景使用。日志和下游系统必须通过明确允许列表只记录所需字段，不得存储或转发原始响应。

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

不支持空 PATCH 请求体，也不支持在一个请求体中组合多个逻辑操作。每次请求必须只发送一种已记录的操作结构。客户端契约不能替代服务器端操作校验；在服务器能于返回任何数据前拒绝不受支持的结构之前，资源 API 只能限于受信任场景。

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

支持的分页参数是 `page` 和 `pageSize`；`limit` 和 `offset` 不是 API 查询参数。搜索使用 PostgreSQL 全文搜索，并以标题、别名、渲染纯文本和分类名称上的前缀匹配及不区分大小写子字符串匹配作为回退。空的 `q` 不返回结果。结果结构为 `{ "rows": [...], "count": number }`。

### 分类

```http
GET /api/v1/categories
GET /api/v1/categories/{slug}
```

分类列表和详情只包含已发布、未删除页面的关联关系。

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

上传会根据站点大小限制和 MIME 允许列表检查，并通过 `NEXTWIKI_MEDIA_DRIVER` 选择的运行时适配器存储。当 `file-type` 无法识别字节内容时，当前检测器会回退到客户端声明的 MIME 类型；部署者应维持严格的允许列表，不应把 v0.1.0 的上传检查视为完整内容验证。

`GET /media/{id}` 返回 `{ "references": [...] }`，而不是文件二进制。本地存储返回持久的应用地址。使用 S3 时，当前适配器可能返回有时限的签名 `publicUrl`；长期页面内容应使用同源 `/media/{storageKey}` 应用路由，使授权和地址更新发生在读取时。如果已发布页面仍引用该资源，删除会返回 `409`，除非提供 `force=true`。

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
