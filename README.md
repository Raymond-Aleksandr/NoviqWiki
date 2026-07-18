# NoviqWiki

> [English](README.md) | [简体中文](README.md#简体中文)

[![CI](https://github.com/Raymond-Aleksandr/NoviqWiki/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Raymond-Aleksandr/NoviqWiki/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-4f46e5)](package.json)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-11.7.0-F69220?logo=pnpm&logoColor=white)](package.json)
[![Docker Compose](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](compose.yaml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

NoviqWiki is a self-hosted, open-source wiki platform built as a TypeScript modular monolith. It provides public article browsing, Markdown editing, immutable revisions, revision comparison and rollback, PostgreSQL full-text search, role-based access control (RBAC), media management, administration, audit logs, backup and restore tooling, and Docker-based deployment.

The project is not a MediaWiki fork, wrapper, migration utility, compatibility layer, extension host, or Wikitext implementation.

## Features

- First-run setup wizard with initial `Owner` creation
- Username or email login, configurable registration, email verification, password reset, HttpOnly same-site sessions, and Argon2id password hashing
- Users, groups, built-in roles, granular permissions, and final-`Owner` protection
- Markdown pages with drafts, publication, immutable revisions, optimistic concurrency, redirects, categories, wiki links, table of contents, diffs, and rollback
- PostgreSQL full-text search with category filters and ranked excerpts
- Local media storage by default, optional S3-compatible storage, MIME and size validation, randomized storage keys, and media references
- Responsive Classic wiki UI with English and Simplified Chinese interface strings, light and dark themes, a public homepage, article pages, recent changes, and an admin dashboard
- Versioned `/api/v1` JSON endpoints and a generated OpenAPI artifact
- Docker Compose deployment, migrations, health and readiness endpoints, and backup and restore scripts
- Vitest unit and integration tests, Playwright end-to-end tests, GitHub Actions CI, and a container-image release workflow

## Docker Quick Start

Prerequisites: Docker Engine and the Docker Compose plugin.

For a persistent installation, copy the environment template and set a stable secret before starting the containers:

```bash
cp .env.example .env
openssl rand -base64 32
```

Paste the generated value after `NEXTWIKI_SECRET=` in `.env`, then start NoviqWiki:

```bash
docker compose up --build -d
```

Open <http://localhost:3000/setup> and complete the setup wizard. Check container state with `docker compose ps` and logs with `docker compose logs --tail=200 app`.

If `NEXTWIKI_SECRET` is empty, the container generates an ephemeral runtime secret. That is convenient for short-lived evaluation, but recreating the container invalidates existing sessions. Always set a stable secret before a long-lived or production deployment. Review [Configuration](docs/CONFIGURATION.md) and [Deployment](docs/DEPLOYMENT.md) before exposing an instance to the internet.

## Local Development

Prerequisites:

- Node.js 22 or newer
- pnpm 10 or newer; the repository currently pins pnpm 11.7.0 through `packageManager`
- PostgreSQL 17 for the repository-matched setup, or the included Compose database service

Install dependencies and create a local environment file:

```bash
corepack enable
pnpm install
cp .env.example .env
```

When the app runs on the host and PostgreSQL runs in Compose, set at least these values in `.env`:

```dotenv
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
NEXTWIKI_BASE_URL=http://localhost:3000
NEXTWIKI_SECRET=replace-with-a-long-random-secret
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

Generate the secret with `openssl rand -base64 32`, start PostgreSQL, apply migrations, and start the development server:

```bash
docker compose up -d db
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>. On a fresh database, the app directs you to the setup wizard. Run `pnpm db:seed` only when you intentionally want the repository's preset development data.

See [Quickstart](docs/QUICKSTART.md) and [Development](docs/DEVELOPMENT.md) for LAN access, database variations, and troubleshooting.

## Command Reference

### Application and quality

```bash
pnpm dev               # Start the Next.js development server
pnpm build             # Create a production build
pnpm start             # Start an existing production build
pnpm format            # Rewrite files with Prettier
pnpm format:check      # Check formatting without changing files
pnpm lint              # Run ESLint
pnpm typecheck         # Run the TypeScript compiler check
pnpm test              # Run unit tests
pnpm test:integration  # Run isolated in-memory PGlite integration tests
pnpm test:ui           # Audit an already-running local review app
pnpm test:e2e          # Run the disposable-database browser suite
```

`pnpm test:ui` does not start or reset the app; authenticated routes are skipped unless local audit credentials are supplied. `pnpm test:e2e` may reset only a database whose name is recognized as disposable. Read [Testing](docs/TESTING.md) before running either command.

### Database, search, operations, and API

```bash
pnpm db:generate       # Generate a Drizzle migration
pnpm db:migrate        # Apply migrations
pnpm db:seed           # Create preset development seed data
pnpm search:reindex    # Rebuild the search index
pnpm backup            # Back up the database and local-driver media
pnpm restore           # Restore an approved backup
pnpm openapi           # Regenerate docs/openapi.json
```

Review generated migrations before applying them to shared environments. Read [Backup and restore](docs/BACKUP_RESTORE.md) before using restore against important data.

## Documentation

### Install and operate

- [Quickstart](docs/QUICKSTART.md)
- [Configuration](docs/CONFIGURATION.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [Upgrading](docs/UPGRADING.md)

### Architecture and product behavior

- [Architecture](docs/ARCHITECTURE.md)
- [Authorization](docs/AUTHORIZATION.md)
- [Content format](docs/CONTENT_FORMAT.md)
- [API guide](docs/API.md)
- [OpenAPI artifact](docs/openapi.json)

### Develop and verify

- [Development](docs/DEVELOPMENT.md)
- [Testing](docs/TESTING.md)

## Community and Security

- Read [Contributing](CONTRIBUTING.md) before proposing or submitting a change.
- Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report suspected vulnerabilities privately according to the [Security Policy](SECURITY.md); do not put exploitable details in a public issue.
- See the [Changelog](CHANGELOG.md) for the current development snapshot.

## Project Status

The current source version is `0.1.0`. NoviqWiki is pre-1.0 self-hosted software. The JSON resource API is limited to same-origin trusted integrations; review the current boundaries in [API](docs/API.md) and [Authorization](docs/AUTHORIZATION.md), plus the private-media cache warning in [Deployment](docs/DEPLOYMENT.md), before enabling untrusted accounts. Review the [Security Policy](SECURITY.md), set production secrets, make backups, and run the verification commands in [Testing](docs/TESTING.md) before operating an internet-facing instance.

## License

Apache-2.0. See [LICENSE](LICENSE).

---

## 简体中文

> [English](README.md) | [简体中文](README.md#简体中文)

NoviqWiki 是一个采用 TypeScript 模块化单体架构构建的自托管开源 wiki 平台。它提供公开条目浏览、Markdown 编辑、不可变修订、修订比较与回滚、PostgreSQL 全文搜索、基于角色的访问控制（RBAC）、媒体管理、后台管理、审计日志、备份与恢复工具，以及基于 Docker 的部署方式。

本项目不是 MediaWiki 的分支、封装、迁移工具、兼容层、扩展宿主或 Wikitext 实现。

### 功能

- 首次运行初始化向导与初始 `Owner`（所有者）创建
- 用户名或邮箱登录、可配置注册方式、邮箱验证、密码重置、HttpOnly 同站点会话与 Argon2id 密码哈希
- 用户、用户组、内置角色、细粒度权限与最后一个 `Owner` 保护
- 支持草稿、发布、不可变修订、乐观并发、重定向、分类、wiki 链接、目录、差异比较与回滚的 Markdown 页面
- 支持分类筛选和相关性摘要的 PostgreSQL 全文搜索
- 默认本地媒体存储、可选 S3 兼容存储、MIME 与大小验证、随机存储键及媒体引用
- 提供英文和简体中文界面、浅色与深色主题、公开首页、条目页面、最近更改和管理仪表盘的响应式经典 wiki 界面
- 带版本的 `/api/v1` JSON 端点和生成的 OpenAPI 文档
- Docker Compose 部署、数据库迁移、健康与就绪端点，以及备份与恢复脚本
- Vitest 单元与集成测试、Playwright 端到端测试、GitHub Actions CI 和容器镜像发布工作流

### Docker 快速开始

前置条件：Docker Engine 和 Docker Compose 插件。

对于长期运行的实例，请先复制环境变量模板并设置稳定的密钥：

```bash
cp .env.example .env
openssl rand -base64 32
```

将生成的值粘贴到 `.env` 中的 `NEXTWIKI_SECRET=` 后，再启动 NoviqWiki：

```bash
docker compose up --build -d
```

打开 <http://localhost:3000/setup> 并完成初始化向导。可使用 `docker compose ps` 检查容器状态，使用 `docker compose logs --tail=200 app` 查看日志。

如果 `NEXTWIKI_SECRET` 为空，容器会生成仅供当前运行期使用的临时密钥。这便于短期评估，但重新创建容器会使现有会话失效。长期或生产部署前必须设置稳定密钥。将实例暴露到互联网前，请阅读[配置](docs/CONFIGURATION.md)和[部署](docs/DEPLOYMENT.md)文档。

### 本地开发

前置条件：

- Node.js 22 或更高版本
- pnpm 10 或更高版本；仓库当前通过 `packageManager` 固定使用 pnpm 11.7.0
- 与仓库配置一致的 PostgreSQL 17，或 Compose 中包含的数据库服务

安装依赖并创建本地环境变量文件：

```bash
corepack enable
pnpm install
cp .env.example .env
```

当应用在主机运行而 PostgreSQL 在 Compose 中运行时，请至少在 `.env` 中设置以下值：

```dotenv
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
NEXTWIKI_BASE_URL=http://localhost:3000
NEXTWIKI_SECRET=replace-with-a-long-random-secret
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

使用 `openssl rand -base64 32` 生成密钥，然后启动 PostgreSQL、应用迁移并启动开发服务器：

```bash
docker compose up -d db
pnpm db:migrate
pnpm dev
```

打开 <http://localhost:3000>。对于全新数据库，应用会引导你进入初始化向导。仅在确实需要仓库预设的开发数据时运行 `pnpm db:seed`。

有关局域网访问、其他数据库配置和故障排查，请参阅[快速开始](docs/QUICKSTART.md)和[开发指南](docs/DEVELOPMENT.md)。

### 命令参考

#### 应用与质量检查

```bash
pnpm dev               # 启动 Next.js 开发服务器
pnpm build             # 创建生产构建
pnpm start             # 启动已有的生产构建
pnpm format            # 使用 Prettier 重写文件
pnpm format:check      # 不修改文件，仅检查格式
pnpm lint              # 运行 ESLint
pnpm typecheck         # 运行 TypeScript 编译检查
pnpm test              # 运行单元测试
pnpm test:integration  # 运行隔离的内存 PGlite 集成测试
pnpm test:ui           # 审核已在运行的本地预览应用
pnpm test:e2e          # 运行使用一次性数据库的浏览器测试套件
```

`pnpm test:ui` 不会启动或重置应用；如果没有提供本地审核凭据，会跳过需要身份验证的路由。`pnpm test:e2e` 只能重置名称被识别为一次性用途的数据库。运行这两个命令前请阅读[测试指南](docs/TESTING.md)。

#### 数据库、搜索、运维与 API

```bash
pnpm db:generate       # 生成 Drizzle 迁移
pnpm db:migrate        # 应用迁移
pnpm db:seed           # 创建预设的开发种子数据
pnpm search:reindex    # 重建搜索索引
pnpm backup            # 备份数据库和本地驱动中的媒体
pnpm restore           # 恢复已确认的备份
pnpm openapi           # 重新生成 docs/openapi.json
```

将生成的迁移应用到共享环境前必须先审查。对重要数据执行恢复操作前，请阅读[备份与恢复](docs/BACKUP_RESTORE.md)。

### 文档

#### 安装与运维

- [快速开始](docs/QUICKSTART.md)
- [配置](docs/CONFIGURATION.md)
- [部署](docs/DEPLOYMENT.md)
- [备份与恢复](docs/BACKUP_RESTORE.md)
- [升级](docs/UPGRADING.md)

#### 架构与产品行为

- [架构](docs/ARCHITECTURE.md)
- [授权](docs/AUTHORIZATION.md)
- [内容格式](docs/CONTENT_FORMAT.md)
- [API 指南](docs/API.md)
- [OpenAPI 文档](docs/openapi.json)

#### 开发与验证

- [开发指南](docs/DEVELOPMENT.md)
- [测试指南](docs/TESTING.md)

### 社区与安全

- 提议或提交更改前，请阅读[贡献指南](CONTRIBUTING.md)。
- 参与本项目须遵守[行为准则](CODE_OF_CONDUCT.md)。
- 发现疑似漏洞时，请按照[安全策略](SECURITY.md)进行私密报告；不要在公开 issue 中提供可利用细节。
- 当前开发快照的变化请参阅[更新日志](CHANGELOG.md)。

### 项目状态

当前源码版本为 `0.1.0`。NoviqWiki 仍是 1.0 之前的自托管软件。JSON 资源 API 仅限同源受信任集成；启用不受信任账户前，请阅读 [API](docs/API.md) 与[授权](docs/AUTHORIZATION.md)中的当前边界，以及[部署](docs/DEPLOYMENT.md)中的私有媒体缓存警告。运行面向互联网的实例前，还应阅读[安全策略](SECURITY.md)、设置生产密钥、创建备份，并运行[测试指南](docs/TESTING.md)中的验证命令。

### 许可证

Apache-2.0。详见 [LICENSE](LICENSE)。
