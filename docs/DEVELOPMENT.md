# NoviqWiki Development

> [English](DEVELOPMENT.md) | [简体中文](DEVELOPMENT.md#简体中文)

NoviqWiki is a TypeScript modular monolith built with the Next.js App Router, PostgreSQL, and Drizzle ORM. Domain modules are the intended owners of application behavior; React components should render data and invoke server actions or routes without querying the database directly. See [Architecture](./ARCHITECTURE.md#request-and-mutation-flow) for the current admin-page exceptions.

## Prerequisites

- Node.js 22 or newer.
- pnpm 10 or newer; the repository currently pins `pnpm@11.7.0` through `packageManager`.
- Docker and Docker Compose for the default local PostgreSQL service, or a separately managed PostgreSQL instance.
- PostgreSQL client tools when using host-level `pg_dump`, `psql`, or manual database operations.

## Project Structure

| Path                | Purpose                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`           | App Router pages, layouts, route handlers, server actions, and `/api/v1` endpoints.                                                          |
| `src/modules`       | Domain services for setup, identity, authorization, pages, revisions, rendering, search, media, settings, audit, and related business rules. |
| `src/db`            | Drizzle schema, database client, and site-level database helpers.                                                                            |
| `src/components`    | React UI components that receive data or call actions and routes.                                                                            |
| `src/lib`           | Shared infrastructure helpers that are not domain-specific.                                                                                  |
| `drizzle`           | Generated, reviewed SQL migrations and Drizzle migration metadata.                                                                           |
| `scripts`           | Operational and verification entry points for migrations, seed, search reindex, backup, restore, OpenAPI, e2e, and UI audit.                 |
| `tests/unit`        | Fast unit and small rendering/component-boundary tests.                                                                                      |
| `tests/integration` | Service and migration-SQL tests using an in-process PGlite database.                                                                         |
| `tests/e2e`         | Browser workflows against a disposable real PostgreSQL database and a production build by default.                                           |
| `docs`              | User, operator, architecture, API, development, and verification guidance.                                                                   |

## Core Rules

- Keep domain logic in `src/modules/**`.
- React components must not query the database directly.
- Route handlers and server actions validate untrusted input with Zod or an equivalently explicit boundary validator.
- Route handlers and server actions delegate business behavior to domain services.
- Enforce authorization server-side for every privileged read or mutation; UI visibility is not a security boundary.
- Markdown is the canonical page source.
- Store sanitized rendered HTML and searchable plain text in immutable revisions.
- Preserve historical revision immutability and transactional current-revision updates.
- Do not add MediaWiki compatibility, migration, extension, or API behavior.
- Update relevant documentation and verification evidence when behavior or setup changes.

## Host Development Setup

Install dependencies:

```bash
pnpm install
```

Start the repository PostgreSQL service:

```bash
docker compose up -d db
```

Create a Next.js local environment file:

```bash
cp .env.example .env.local
```

The template contains container paths. For `pnpm dev` on the host, make at least these changes in `.env.local`:

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki
NOVIQWIKI_BASE_URL=http://localhost:3000
NOVIQWIKI_SECRET=replace-with-a-long-random-development-secret
NOVIQWIKI_MEDIA_DRIVER=local
NOVIQWIKI_MEDIA_ROOT=./media
NOVIQWIKI_STORAGE_PUBLIC_PATH=/media
```

Use `localhost`, not the Compose hostname `db`, because the Next.js process is running on the host. Likewise, use a host-writable media directory such as `./media`, not the container path `/app/media`.

Repository TypeScript scripts load `.env`, not `.env.local`, through `dotenv/config`. Apply migrations by exporting the host URL explicitly or selecting the file:

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki pnpm db:migrate
```

Equivalent explicit file loading:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

Start the application:

```bash
pnpm dev
```

Open `http://localhost:3000/setup` on a fresh database and complete the setup wizard. A database with no site uses the full flow. If an existing site has zero users, the same route enters an Owner-only bootstrap that preserves existing content, media, and settings while creating the first Owner. Keep that application isolated from untrusted networks until bootstrap completes.

## Full Compose Evaluation

To run both the application and PostgreSQL inside Compose instead of running `pnpm dev` on the host:

```bash
docker compose up --build -d
```

When `NOVIQWIKI_SECRET` is unset or empty, the entrypoint reuses `/app/secrets/noviqwiki-secret` from the persistent `noviqwiki-secrets` volume or generates that fallback if it is missing. An explicitly supplied environment value is used directly, is never written to the fallback file or an environment file, and causes startup to proactively delete any old fallback file. If the explicit value is later removed, the next start generates a new fallback; the secret change invalidates existing HMAC-backed sessions, email-verification tokens, and password-reset tokens. This fallback is convenient for evaluation, but production should explicitly provide a stable managed secret. `docker compose down` preserves the volume; `docker compose down -v` deletes it together with the database, media, and backup volumes, and `pnpm backup` does not copy it.

The committed Compose service correctly uses `db` and `/app/media` inside the container. It is an evaluation configuration with example credentials and published ports, not a production security baseline. See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Seed Data

The setup wizard is the normal first-run path. For disposable development data only:

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki pnpm db:seed
```

On a fresh database, the seed script creates development credentials including `owner / OwnerPassword123`. It is disabled when `NODE_ENV=production`. Never expose or reuse seeded credentials in a shared or production environment.

## LAN and Mobile Review

Bind the development server to all interfaces and allow the workstation IP:

```bash
NOVIQWIKI_ALLOWED_DEV_ORIGINS=192.168.1.20 pnpm exec next dev -H 0.0.0.0 -p 3100
```

Replace `192.168.1.20` with the host IP. Review devices must be on a permitted network, and the workstation firewall must allow the selected port. Do not expose a development server directly to the public internet.

If links or recovery URLs need to use the LAN address, update both `NOVIQWIKI_BASE_URL` before setup and the stored base URL in `/admin/settings` after setup. The `NOVIQWIKI_BASE_URL` scheme, not `NODE_ENV`, controls the session and CSRF cookies' `Secure` attribute: `https:` enables it and `http:` disables it.

## Feature Workflow

For a typical feature:

1. Define or update the domain behavior in `src/modules`.
2. Add schema definitions and a reviewed migration when persistence changes.
3. Define a Zod input boundary for routes and server actions.
4. Resolve the current actor and enforce the required permission server-side.
5. Call the domain service from the route or action.
6. Render results through React components without direct database access.
7. Add audit events for privileged, security-sensitive, or operational mutations.
8. Add denied-path coverage as well as the allowed path.
9. Add the smallest appropriate unit, integration, browser, or live UI audit coverage.
10. Update English and Simplified Chinese UI strings and documentation together.

Keep errors safe for end users while retaining enough structured context for operators. Do not log secrets, raw cookies, tokens, credential-bearing URLs, or uploaded content bodies.

## Database Changes

Schema changes must be represented by Drizzle migrations in `drizzle/`. Do not rely on runtime schema mutation.

Typical local workflow:

```bash
pnpm db:generate
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki pnpm db:migrate
```

Review generated SQL before applying it. Confirm constraints, defaults, indexes, foreign-key behavior, data backfills, lock duration, and compatibility with the previous application version. Integration tests execute the migration SQL in PGlite, while e2e and deployment validation provide the real PostgreSQL layer; use a representative PostgreSQL staging copy for risky migrations.

For any production-affecting migration, document forward behavior, backward compatibility, rollout ordering, and the backup/restore rollback plan.

## Content Pipeline

When a page is published, the domain workflow must:

1. Validate input and normalize page identity.
2. Authorize the actor.
3. Render the Markdown source.
4. Sanitize rendered HTML.
5. Extract searchable plain text, headings, categories, and wiki-link metadata.
6. Store the Markdown, sanitized HTML, plain text, and derived metadata in a new immutable revision.
7. Update page links, categories, aliases, redirects, and search data as required.
8. Mark the new revision as current in the same transaction.
9. Write the appropriate audit event.

Historical revisions are immutable. A rollback creates another revision rather than changing an old one.
Saving a draft updates the editor's mutable draft record and does not create a revision or refresh public projections.

## Authorization Development

Every privileged service must accept an actor or service context and verify the permission at the domain or server boundary. Never rely on a hidden button, route naming, or client-side state for access control.

Tests should cover:

- The authorized path.
- An anonymous or insufficient-permission path.
- The absence of data mutation after denial.
- Cross-site or cross-resource identifier handling where applicable.
- Final Owner, built-in role, page-protection, and restricted-content invariants affected by the change.

## English and Simplified Chinese UI

User-visible application strings belong in `src/i18n/en.ts` and `src/i18n/zh-CN.ts`. Keep the dictionary keys and value shapes aligned. Add or update localization tests for system-generated errors, authorization labels, audit actions, and revision summaries when relevant.

Do not translate route paths, environment-variable names, code identifiers, commands, or stored user-authored content. Validate both locales at narrow and desktop widths for text expansion and wrapping.

## Quality Gates

Use the smallest relevant subset while iterating:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Before completion, run the repository's full required suite:

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

Use `pnpm format:check` when a read-only formatting check is required. `pnpm format` writes formatting changes.

Use `docker compose config --quiet` for a human gate. Plain `docker compose config` renders resolved environment values, including secrets, and must not be saved in logs or review artifacts.

The live UI audit is additional and requires a running server:

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

An authenticated release audit also needs the credentials and fixture guidance in [TESTING.md](./TESTING.md#ui-release-audit).

`pnpm test:e2e` resets only a database whose name contains a separate `test`, `e2e`, or `ci` token. By default it uses `noviqwiki_e2e`, builds the application, and serves the standalone production output on port `3101`. It does not replace the non-reset UI audit.

If a gate cannot run, record the exact command, reason, and unverified scope. Never report a command as passing based on an earlier checkout.

---

## 简体中文

> [English](DEVELOPMENT.md) | [简体中文](DEVELOPMENT.md#简体中文)

NoviqWiki 是使用 Next.js App Router、PostgreSQL 和 Drizzle ORM 构建的 TypeScript 模块化单体。领域模块应当负责应用行为；React 组件应只渲染数据并调用服务器操作或路由，不直接查询数据库。当前管理页面的例外见[架构](./ARCHITECTURE.md#请求与写操作流程)。

### 前置条件

- Node.js 22 或更高版本。
- pnpm 10 或更高版本；仓库当前通过 `packageManager` 固定 `pnpm@11.7.0`。
- 用于默认本地 PostgreSQL 服务的 Docker 和 Docker Compose，或单独管理的 PostgreSQL 实例。
- 使用主机级 `pg_dump`、`psql` 或手动数据库操作时所需的 PostgreSQL 客户端工具。

### 项目结构

| 路径                | 用途                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `src/app`           | App Router 页面、布局、路由处理程序、服务器操作和 `/api/v1` 端点。                     |
| `src/modules`       | 设置、身份、授权、页面、修订、渲染、搜索、媒体、设置项、审计及相关业务规则的领域服务。 |
| `src/db`            | Drizzle 架构、数据库客户端和站点级数据库辅助函数。                                     |
| `src/components`    | 接收数据或调用操作与路由的 React UI 组件。                                             |
| `src/lib`           | 不属于特定领域的共享基础设施辅助函数。                                                 |
| `drizzle`           | 已生成并审查的 SQL 迁移及 Drizzle 迁移元数据。                                         |
| `scripts`           | 迁移、种子、搜索重建、备份、恢复、OpenAPI、e2e 和 UI 审计的运维与验证入口。            |
| `tests/unit`        | 快速单元测试以及小型渲染或组件边界测试。                                               |
| `tests/integration` | 使用进程内 PGlite 数据库的服务和迁移 SQL 测试。                                        |
| `tests/e2e`         | 默认针对可丢弃真实 PostgreSQL 数据库和生产构建运行的浏览器流程。                       |
| `docs`              | 用户、运维、架构、API、开发和验证说明。                                                |

### 核心规则

- 领域逻辑放在 `src/modules/**`。
- React 组件不得直接查询数据库。
- 路由处理程序和服务器操作使用 Zod 或同等明确的边界校验器验证不可信输入。
- 路由处理程序和服务器操作将业务行为委托给领域服务。
- 每个特权读取或变更都必须在服务器端执行授权；UI 可见性不是安全边界。
- Markdown 是页面的权威源格式。
- 在不可变修订中保存经过清理的 HTML 和可搜索纯文本。
- 保持历史修订不可变，并在事务中更新当前修订。
- 不得添加 MediaWiki 兼容、迁移、扩展或 API 行为。
- 行为或设置发生变化时更新相关文档和验证证据。

### 主机开发设置

安装依赖：

```bash
pnpm install
```

启动仓库 PostgreSQL 服务：

```bash
docker compose up -d db
```

创建 Next.js 本地环境文件：

```bash
cp .env.example .env.local
```

模板包含容器路径。要在主机上运行 `pnpm dev`，至少应在 `.env.local` 中改为：

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki
NOVIQWIKI_BASE_URL=http://localhost:3000
NOVIQWIKI_SECRET=replace-with-a-long-random-development-secret
NOVIQWIKI_MEDIA_DRIVER=local
NOVIQWIKI_MEDIA_ROOT=./media
NOVIQWIKI_STORAGE_PUBLIC_PATH=/media
```

Next.js 进程在主机上运行，因此应使用 `localhost`，而不是 Compose 主机名 `db`。同理，应使用 `./media` 等主机可写媒体目录，而不是容器路径 `/app/media`。

仓库 TypeScript 脚本通过 `dotenv/config` 加载 `.env`，不会加载 `.env.local`。可显式导出主机 URL 后应用迁移：

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki pnpm db:migrate
```

也可显式选择文件：

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

启动应用：

```bash
pnpm dev
```

在全新数据库上打开 `http://localhost:3000/setup` 并完成设置向导。没有站点的数据库使用完整流程。如果现有站点的用户数为零，同一路由会进入仅限 Owner 的引导流程；它会保留现有内容、媒体和设置，只创建首个 Owner。在引导完成前，应让该应用与不受信任网络隔离。

### 完整 Compose 评估

如果希望应用和 PostgreSQL 都在 Compose 内运行，而不是在主机运行 `pnpm dev`：

```bash
docker compose up --build -d
```

未设置 `NOVIQWIKI_SECRET` 或其值为空时，入口会从持久化 `noviqwiki-secrets` 卷复用 `/app/secrets/noviqwiki-secret`；若该回退文件不存在，则生成它。显式提供的环境值会直接使用，绝不会写入回退文件或环境文件，并且启动时会主动删除任何旧回退文件。如果后来移除显式值，下次启动会生成新回退；密钥变化会使现有依赖 HMAC 的会话、电子邮件验证令牌和密码重置令牌失效。此回退行为便于评估，但生产环境应显式提供稳定的受管密钥。`docker compose down` 会保留该卷；`docker compose down -v` 会将它与数据库、媒体和备份卷一并删除，而 `pnpm backup` 不会复制它。

提交的 Compose 服务在容器内正确使用 `db` 和 `/app/media`。它使用示例凭据和公开端口，只适合评估，不是生产安全基线。参见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

### 种子数据

设置向导是正常的首次运行路径。仅对可丢弃开发数据使用：

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki pnpm db:seed
```

在全新数据库上，种子脚本会创建包括 `owner / OwnerPassword123` 在内的开发凭据。`NODE_ENV=production` 时该脚本会被禁用。绝不能在共享或生产环境暴露或复用种子凭据。

### 局域网与移动设备检查

将开发服务器绑定到所有接口，并允许工作站 IP：

```bash
NOVIQWIKI_ALLOWED_DEV_ORIGINS=192.168.1.20 pnpm exec next dev -H 0.0.0.0 -p 3100
```

将 `192.168.1.20` 替换为主机 IP。检查设备必须处于允许的网络中，工作站防火墙也必须允许所选端口。不要把开发服务器直接暴露到公共互联网。

若链接或恢复 URL 需要使用局域网地址，请在设置前更新 `NOVIQWIKI_BASE_URL`，并在设置后通过 `/admin/settings` 更新已存储的基础 URL。会话和 CSRF Cookie 的 `Secure` 属性由 `NOVIQWIKI_BASE_URL` 的协议决定，而不是 `NODE_ENV`：`https:` 会启用它，`http:` 会禁用它。

### 功能开发流程

典型功能应按以下顺序进行：

1. 在 `src/modules` 定义或更新领域行为。
2. 持久化发生变化时增加架构定义和经过审查的迁移。
3. 为路由和服务器操作定义 Zod 输入边界。
4. 解析当前操作人并在服务器端强制检查所需权限。
5. 从路由或操作调用领域服务。
6. 通过 React 组件渲染结果，不直接访问数据库。
7. 为特权、安全敏感或运维变更添加审计事件。
8. 同时覆盖允许路径和拒绝路径。
9. 根据风险添加最小合适的单元、集成、浏览器或在线 UI 审计覆盖。
10. 同步更新英文、简体中文 UI 字符串和文档。

面向最终用户的错误应安全，同时为运维保留足够的结构化上下文。不得记录密钥、原始 Cookie、令牌、含凭据的 URL 或上传内容正文。

### 数据库变更

架构变更必须由 `drizzle/` 中的 Drizzle 迁移表示，不要依赖运行时架构修改。

典型本地流程：

```bash
pnpm db:generate
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki pnpm db:migrate
```

应用前检查生成的 SQL。确认约束、默认值、索引、外键行为、数据回填、锁定时间以及与旧应用版本的兼容性。集成测试在 PGlite 中执行迁移 SQL，而 e2e 和部署验证提供真实 PostgreSQL 层；高风险迁移应使用有代表性的 PostgreSQL 预发布副本。

任何影响生产的迁移都应记录向前行为、向后兼容性、发布顺序和备份恢复回滚方案。

### 内容处理流水线

发布页面时，领域流程必须：

1. 验证输入并规范化页面标识。
2. 授权操作人。
3. 渲染 Markdown 源。
4. 清理渲染后的 HTML。
5. 提取可搜索纯文本、标题、分类和 Wiki 链接元数据。
6. 将 Markdown、清理后的 HTML、纯文本和派生元数据保存到新的不可变修订。
7. 按需更新页面链接、分类、别名、重定向和搜索数据。
8. 在同一事务中将新修订设为当前修订。
9. 写入相应审计事件。

历史修订不可变。回滚会创建新修订，而不是修改旧修订。
保存草稿只会更新该编辑者的可变草稿记录，不会创建修订或刷新公开投影。

### 授权开发

每个特权服务都必须接收操作人或服务上下文，并在领域或服务器边界验证权限。绝不能依赖隐藏按钮、路由名称或客户端状态进行访问控制。

测试应覆盖：

- 已授权路径。
- 匿名或权限不足路径。
- 拒绝后没有发生数据变更。
- 适用时的跨站点或跨资源标识处理。
- 变更所影响的最后一个所有者、内置角色、页面保护和受限内容不变量。

### 英文与简体中文 UI

用户可见的应用字符串放在 `src/i18n/en.ts` 和 `src/i18n/zh-CN.ts`。字典键和值结构应保持一致。涉及系统错误、授权标签、审计操作和修订摘要时，应增加或更新本地化测试。

不要翻译路由路径、环境变量名、代码标识符、命令或用户编写的存储内容。应在窄屏和桌面宽度下分别验证两种语言的文本扩展与换行。

### 质量门禁

迭代时先运行最小相关子集：

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

需要只读格式检查时使用 `pnpm format:check`。`pnpm format` 会写入格式化变更。

人类门禁应使用 `docker compose config --quiet`。普通 `docker compose config` 会渲染解析后的环境变量值，包括密钥，不得把其输出保存到日志或审查制品中。

在线 UI 审计是额外步骤，要求服务器已经运行：

```bash
UI_AUDIT_BASE_URL=http://localhost:3000 pnpm test:ui
```

已登录发布审计还需要 [TESTING.md](./TESTING.md#ui-发布审计) 中说明的凭据和测试数据。

`pnpm test:e2e` 只会重置数据库名中含独立 `test`、`e2e` 或 `ci` 标记的数据库。默认使用 `noviqwiki_e2e`，构建应用，并在 `3101` 端口提供独立生产输出。它不能替代非重置 UI 审计。

如果某项门禁无法运行，应记录准确命令、原因和未验证范围。绝不能根据旧检出结果宣称命令通过。
