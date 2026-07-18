# Changelog / 更新日志

> [English](CHANGELOG.md) | [简体中文](CHANGELOG.md#简体中文)

## English

This changelog records user-visible and operator-visible changes in the source tree. The repository currently identifies itself as `0.1.0`, but no tagged release is implied by the unreleased section below.

### [Unreleased]

Snapshot date: 2026-07-18

#### Added

- Prepared the initial NoviqWiki self-hosted wiki implementation.
- Added first-run setup, local authentication, sessions, configurable registration, email verification, password reset, and RBAC.
- Added Markdown pages, drafts, publishing, immutable revisions, diffs, rollback, redirects, categories, wiki links, and PostgreSQL search.
- Added media upload and management with local storage by default and optional S3-compatible storage.
- Added administration screens for users, groups, roles, pages, media, settings, audit logs, and operational status.
- Added Docker Compose deployment, health and readiness endpoints, backup and restore scripts, OpenAPI output, CI configuration, and a container-image release workflow.
- Added a responsive Classic UI with English and Simplified Chinese interface strings.

#### Changed

- Completed the provisional internal-identifier migration: every project-owned environment variable uses the `NOVIQWIKI_*` prefix, while the default PostgreSQL identity, Compose data volumes, runtime account, E2E database, and target-bound operational labels consistently use `noviqwiki`. Deployments based on an earlier draft must update their environment keys and deliberately migrate retained database, media, and backup state before starting this checkout.
- Added a guarded Owner-only setup mode for databases that contain a site but no active Owner, preserving existing site settings, content, and non-Owner accounts while restoring ownership. Public registration remains blocked until an active Owner exists: complete sites keep an unlocked registration fast path, while an incomplete preflight enters the same advisory lock as setup and rechecks state so it cannot race Owner creation.
- Superseded the earlier generated-secret experiment: production and the supplied Compose stack now fail closed unless a stable `NOVIQWIKI_SECRET`, canonical `NOVIQWIKI_BASE_URL`, complete `DATABASE_URL`, and raw `POSTGRES_PASSWORD` are explicitly supplied. The database stays private, `compose.dev.yaml` exposes it only on loopback for host development, and there is no secrets volume or implicit key generation.
- Made the production `NOVIQWIKI_BASE_URL` authoritative for same-origin validation, redirects, citations, and recovery/verification links, while requiring secure production cookies and retaining stored site settings only as a development/test fallback.
- Hardened backup and restore around the exact validated database identity. Only the exact Compose `db` target uses container tools; other targets require local PostgreSQL clients and never switch targets after a failure. Database reset/import is atomic, local media is staged with the old tree retained and rolled back on SQL failure, destructive confirmation binds the database and canonical media root, and non-Compose local media requires explicit quiescence acknowledgement.
- Unified local and S3 media delivery behind authorized same-origin streaming responses. Public sites use `max-age=0, must-revalidate`, private sites use `private, no-store`, unsafe inline types download as attachments, and media deletion checks drafts plus all immutable revisions under concurrency protection.
- Made both local and S3 readiness perform real write/read/delete probes while rejecting unsafe local roots, and added real PostgreSQL 17 migration/concurrency coverage to CI.

---

## 简体中文

> [English](CHANGELOG.md) | [简体中文](CHANGELOG.md#简体中文)

本更新日志记录源码中用户和运维人员可见的变更。仓库当前将自身版本标识为 `0.1.0`，但下方“尚未发布”部分不代表已经创建了带标签的正式版本。

### [尚未发布]

快照日期：2026-07-18

#### 新增

- 完成 NoviqWiki 自托管 wiki 的初始实现。
- 新增首次运行初始化、本地身份验证、会话、可配置注册、邮箱验证、密码重置和 RBAC。
- 新增 Markdown 页面、草稿、发布、不可变修订、差异比较、回滚、重定向、分类、wiki 链接和 PostgreSQL 搜索。
- 新增媒体上传与管理，默认使用本地存储，并可选用 S3 兼容存储。
- 新增用户、用户组、角色、页面、媒体、设置、审计日志和运行状态管理界面。
- 新增 Docker Compose 部署、健康与就绪端点、备份与恢复脚本、OpenAPI 输出、CI 配置和容器镜像发布工作流。
- 新增带英文和简体中文界面文本的响应式经典 UI。

#### 变更

- 完成临时内部标识迁移：所有项目专属环境变量统一使用 `NOVIQWIKI_*` 前缀；默认 PostgreSQL 身份、Compose 数据卷、运行时账户、E2E 数据库及目标绑定运维标签统一使用 `noviqwiki`。基于更早草稿部署的实例必须先更新环境变量键，并有计划地迁移保留的数据库、媒体和备份状态，再启动此检出。
- 为已有站点但没有 active Owner 的数据库增加受保护的仅 Owner 设置模式，在恢复所有权时保留现有站点设置、内容和非 Owner 账号。active Owner 创建前，公开注册会保持阻断：已完整初始化的站点保留无锁注册快速路径；预检未完成时则会进入与设置流程相同的 advisory lock 并重新检查状态，因此无法与 Owner 创建竞争。
- 取代早期自动生成密钥的实验方案：生产环境与提交的 Compose 栈现在会在缺少稳定 `NOVIQWIKI_SECRET`、规范 `NOVIQWIKI_BASE_URL`、完整 `DATABASE_URL` 或原始 `POSTGRES_PASSWORD` 时立即失败。数据库保持私有，主机开发仅由 `compose.dev.yaml` 绑定到回环地址，不再存在密钥卷或隐式密钥生成。
- 将生产 `NOVIQWIKI_BASE_URL` 作为同源校验、重定向、引用及恢复/验证链接的权威源，要求生产 Cookie 安全；数据库站点设置仅作为开发/测试回退。
- 围绕精确校验后的数据库身份强化备份恢复。只有精确 Compose `db` 目标使用容器工具；其他目标必须使用本地 PostgreSQL 客户端，失败后绝不切换目标。数据库重置/导入具有事务原子性，本地媒体先暂存并保留旧树，SQL 失败时回滚；破坏性确认同时绑定数据库和规范媒体根目录，非 Compose 本地媒体还必须显式确认停止写入。
- 将本地与 S3 媒体统一到经过授权的同源流式响应。公开站点使用 `max-age=0, must-revalidate`，私有站点使用 `private, no-store`，不安全内联类型作为附件下载；媒体删除会在并发保护下检查草稿及所有不可变修订。
- 让本地与 S3 就绪检查都执行真实写入/读取/删除探针并拒绝不安全本地根目录，同时在 CI 中加入真实 PostgreSQL 17 迁移与并发覆盖。
