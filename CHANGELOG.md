# Changelog / 更新日志

> [English](CHANGELOG.md) | [简体中文](CHANGELOG.md#简体中文)

## English

This changelog records user-visible and operator-visible changes in the source tree. The repository currently identifies itself as `0.1.0`, but no tagged release is implied by the unreleased section below.

### [Unreleased]

Snapshot date: 2026-07-17

#### Added

- Prepared the initial NoviqWiki self-hosted wiki implementation.
- Added first-run setup, local authentication, sessions, configurable registration, email verification, password reset, and RBAC.
- Added Markdown pages, drafts, publishing, immutable revisions, diffs, rollback, redirects, categories, wiki links, and PostgreSQL search.
- Added media upload and management with local storage by default and optional S3-compatible storage.
- Added administration screens for users, groups, roles, pages, media, settings, audit logs, and operational status.
- Added Docker Compose deployment, health and readiness endpoints, backup and restore scripts, OpenAPI output, CI configuration, and a container-image release workflow.
- Added a responsive Classic UI with English and Simplified Chinese interface strings.

#### Changed

- Added a guarded Owner-only setup mode for databases that contain a site but no users, preserving existing site settings and content while creating the first Owner. Public registration remains blocked until that Owner exists: complete sites keep an unlocked registration fast path, while an incomplete site/user preflight enters the same advisory lock as setup and rechecks state so it cannot race first-Owner creation.
- Persisted the Compose-generated fallback application secret in a dedicated named volume instead of rotating it on every container recreation; activating an explicit `NEXTWIKI_SECRET` now removes any old fallback file so later removal intentionally rotates the secret instead of reviving a stale value.
- Derived the session and CSRF Cookie `Secure` attribute from the `NEXTWIKI_BASE_URL` protocol so local HTTP evaluation and production HTTPS use explicit canonical-origin behavior.
- Made backup and restore independent of unrelated web-runtime secret validation. Local database tools now use a normalized target without ambient libpq routing overrides or passwords in argv; concurrent backups receive unique names. The fixed, repository-anchored Compose fallback requires both a missing local PostgreSQL client and explicit `NEXTWIKI_COMPOSE_FALLBACK=1`. Restore validates complete recognized SQL and safe local-media inputs, binds confirmation to the exact host or Compose identity, and runs the schema reset plus import fail-fast in one transaction.

---

## 简体中文

> [English](CHANGELOG.md) | [简体中文](CHANGELOG.md#简体中文)

本更新日志记录源码中用户和运维人员可见的变更。仓库当前将自身版本标识为 `0.1.0`，但下方“尚未发布”部分不代表已经创建了带标签的正式版本。

### [尚未发布]

快照日期：2026-07-17

#### 新增

- 完成 NoviqWiki 自托管 wiki 的初始实现。
- 新增首次运行初始化、本地身份验证、会话、可配置注册、邮箱验证、密码重置和 RBAC。
- 新增 Markdown 页面、草稿、发布、不可变修订、差异比较、回滚、重定向、分类、wiki 链接和 PostgreSQL 搜索。
- 新增媒体上传与管理，默认使用本地存储，并可选用 S3 兼容存储。
- 新增用户、用户组、角色、页面、媒体、设置、审计日志和运行状态管理界面。
- 新增 Docker Compose 部署、健康与就绪端点、备份与恢复脚本、OpenAPI 输出、CI 配置和容器镜像发布工作流。
- 新增带英文和简体中文界面文本的响应式经典 UI。

#### 变更

- 为已有站点但没有用户的数据库增加受保护的仅 Owner 设置模式，在创建首个 Owner 时保留现有站点设置与内容。首个 Owner 创建前，公开注册会保持阻断：已完整初始化的站点保留无锁注册快速路径；站点/用户预检不完整时则会进入与设置流程相同的 advisory lock 并重新检查状态，因此无法与首个 Owner 创建竞争。
- 将 Compose 自动生成的回退应用密钥保存在专用命名卷中，不再随每次容器重建而轮换；启用显式 `NEXTWIKI_SECRET` 时现在会删除任何旧回退文件，因此日后移除显式值会有意轮换密钥，而不会恢复过时值。
- 根据 `NEXTWIKI_BASE_URL` 协议决定会话和 CSRF Cookie 的 `Secure` 属性，使本地 HTTP 评估与生产 HTTPS 明确遵循规范源配置。
- 让备份与恢复不再依赖无关的 Web 运行时密钥校验。本地数据库工具现在使用规范化目标，不继承环境中的 libpq 路由覆盖，密码也不会出现在 argv 中；并发备份会获得唯一名称。只有在本机缺少 PostgreSQL 客户端且显式设置 `NEXTWIKI_COMPOSE_FALLBACK=1` 时，才会使用固定且锚定到本仓库的 Compose 数据库回退。恢复会验证完整、可识别的 SQL 与安全本地媒体输入，将确认值绑定到准确的主机或 Compose 身份，并在同一个事务中以快速失败方式执行 Schema 重置和导入。
