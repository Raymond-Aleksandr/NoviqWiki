# NoviqWiki Configuration

> [English](CONFIGURATION.md) | [简体中文](CONFIGURATION.md#简体中文)

NoviqWiki is configured primarily through environment variables, with site-level behavior stored in PostgreSQL and managed through the setup wizard or `/admin/settings`. Keep production secrets out of source control and inject them through the deployment platform, Docker secrets, or an approved secret manager.

The current environment-variable namespace is `NEXTWIKI_*`. It is a compatibility namespace and does not change the NoviqWiki product name.

## Environment Files

The application and the repository scripts do not load environment files in exactly the same way:

- Next.js commands such as `pnpm dev` load the standard Next.js environment-file set, including `.env.local`.
- TypeScript operational scripts that import `dotenv/config`—migrations, seed, search reindex, backup, and restore—load `.env` by default, not `.env.local`.
- Docker Compose interpolates shell variables and `.env` by default. It does not automatically read `.env.local`. The current `compose.yaml` hard-codes the development database, base URL, and local-media values and interpolates only `NEXTWIKI_SECRET`.

For host development, start with:

```bash
cp .env.example .env.local
```

Then change container-only values before running the app on the host:

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
NEXTWIKI_MEDIA_ROOT=./media
```

For an operational script, either export the variables in the shell, keep a protected `.env`, or explicitly select the local file:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

For a Compose evaluation with a persistent secret, export it or place it in an untracked `.env`:

```bash
NEXTWIKI_SECRET="$(openssl rand -base64 32)" docker compose up --build -d
```

Never commit a file containing real credentials. Restart the application after changing runtime configuration because environment values are cached in-process.

## Core Runtime Variables

| Variable                | Default                                                | Production guidance                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | `postgres://nextwiki:nextwiki@localhost:5432/nextwiki` | Set an explicit PostgreSQL URL. Use `db` only from a container on the Compose network; use `localhost` from the host with the default port mapping.                                                                            |
| `NEXTWIKI_BASE_URL`     | `http://localhost:3000`                                | Set the externally visible HTTPS origin. It supplies the setup default and the recovery-email fallback. After setup, the base URL stored in site settings is authoritative and must also be updated through `/admin/settings`. |
| `NEXTWIKI_SECRET`       | Development-only fallback outside production           | Required at runtime when `NODE_ENV=production`; the current validator requires at least 32 characters. Keep it stable across all instances and restarts.                                                                       |
| `NODE_ENV`              | `development` in the application schema                | Use the value set by Next.js or the runtime. The production image sets `production`; secure session and CSRF cookies are enabled in production.                                                                                |
| `NEXTWIKI_DB_POOL_SIZE` | `10`                                                   | Maximum PostgreSQL connections per application process. Set a positive integer and budget `instances × pool size` below the provider limit.                                                                                    |
| `NEXTWIKI_LOG_LEVEL`    | `info`                                                 | Pino log level used by code that emits through the project logger, for example `debug`, `info`, `warn`, or `error`.                                                                                                            |

Generate a secret with:

```bash
openssl rand -base64 32
```

The generated value is longer than the current 32-character minimum. Do not use the example development secret in production.

## Local and S3 Media Storage

| Variable                        | Default                                    | Description                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NEXTWIKI_MEDIA_DRIVER`         | `local`                                    | Runtime storage backend: `local` or `s3`. The environment value controls the active adapter.                                                                                                     |
| `NEXTWIKI_MEDIA_ROOT`           | `./media` in code; `/app/media` in Compose | Filesystem directory for local media. Use a persistent mounted volume in production.                                                                                                             |
| `NEXTWIKI_STORAGE_PUBLIC_PATH`  | `/media`                                   | URL prefix stored for local media. Keep `/media` unless the deployment also provides a matching application route or reverse-proxy rewrite; the repository route is currently `/media/[...key]`. |
| `NEXTWIKI_S3_ENDPOINT`          | None                                       | S3-compatible endpoint. The current `s3` validation requires it, including for AWS deployments.                                                                                                  |
| `NEXTWIKI_S3_REGION`            | `us-east-1`                                | Bucket region.                                                                                                                                                                                   |
| `NEXTWIKI_S3_BUCKET`            | None                                       | Bucket for uploaded media. Required with the `s3` driver.                                                                                                                                        |
| `NEXTWIKI_S3_ACCESS_KEY_ID`     | None                                       | Static storage access key. Required with the current `s3` driver.                                                                                                                                |
| `NEXTWIKI_S3_SECRET_ACCESS_KEY` | None                                       | Static storage secret. Required with the current `s3` driver.                                                                                                                                    |

The current S3 client uses path-style requests and explicit static credentials. It does not expose an environment variable for a session token or rely on the default AWS credential-provider chain. Confirm compatibility with the selected provider before production use.

S3 objects are retrieved through one-hour signed GET URLs. Use a private bucket, least-privilege credentials, provider-side encryption, and bucket versioning. Include the object store in backup and restore drills; `pnpm backup` does not copy S3 objects.

Upload size and MIME allowlists are site settings managed at `/admin/settings`, not environment variables. The database default is 5 MiB (`5242880` bytes). The default MIME allowlist is `image/png`, `image/jpeg`, `image/gif`, `image/webp`, and `application/pdf`; SVG is always rejected. The current Next.js Server Action body limit is `10mb`, so a larger site setting cannot make a Server Action accept a body above that framework limit.

## Email

Email delivery is optional. Password-reset and email-verification tokens can be created without SMTP, but the application sends the corresponding message only when both variables are present.

| Variable              | Example                                 | Description                                                               |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `NEXTWIKI_SMTP_URL`   | `smtp://user:pass@smtp.example.com:587` | Nodemailer SMTP connection URL. Percent-encode credentials when required. |
| `NEXTWIKI_EMAIL_FROM` | `NoviqWiki <no-reply@example.com>`      | Sender for system email.                                                  |

Recovery links use the base URL stored in site settings after initial setup, falling back to `NEXTWIKI_BASE_URL` only when no site settings exist. Validate delivery and link origins after configuration changes.

## Backup and Restore Variables

These variables are consumed by repository scripts rather than by the web runtime:

| Variable                   | Default or required value | Description                                                                             |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| `NEXTWIKI_BACKUP_DIR`      | `backups`                 | Output directory used by `pnpm backup`.                                                 |
| `NEXTWIKI_RESTORE_SQL`     | Required for restore      | Path to the plain SQL file consumed by `pnpm restore`.                                  |
| `NEXTWIKI_RESTORE_MEDIA`   | Optional                  | Local-media `.tar.gz` archive extracted during restore when the local driver is active. |
| `NEXTWIKI_RESTORE_CONFIRM` | Must equal `restore`      | Explicit confirmation for the destructive schema reset performed by `pnpm restore`.     |

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) before running either command.

## Development and Test Variables

| Variable                                  | Default                                                                             | Description                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_ALLOWED_DEV_ORIGINS`            | Empty                                                                               | Comma-separated hosts appended to Next.js `allowedDevOrigins` for LAN/mobile checks with the development server.                      |
| `NEXTWIKI_E2E_DATABASE_URL`               | Safe ambient test URL or `postgres://nextwiki:nextwiki@localhost:5432/nextwiki_e2e` | Disposable real PostgreSQL database reset by `pnpm test:e2e`. Its database name must contain a separate `test`, `e2e`, or `ci` token. |
| `NEXTWIKI_E2E_MEDIA_ROOT`                 | `test-results/e2e-media`                                                            | Local media directory used by the e2e server.                                                                                         |
| `PLAYWRIGHT_PORT`                         | `3101`                                                                              | Port used by the e2e server.                                                                                                          |
| `PLAYWRIGHT_BASE_URL`                     | `http://127.0.0.1:<PLAYWRIGHT_PORT>`                                                | Playwright target URL.                                                                                                                |
| `NEXTWIKI_E2E_SKIP_BUILD`                 | Unset                                                                               | Set to `1` only when a compatible `.next` build already exists.                                                                       |
| `NEXTWIKI_E2E_REUSE_SERVER`               | Unset                                                                               | Set to `1` to let Playwright reuse an existing e2e server.                                                                            |
| `NEXTWIKI_E2E_SERVER_MODE`                | `start`                                                                             | Use `dev` only for a deliberate development-server e2e run.                                                                           |
| `UI_AUDIT_BASE_URL`                       | `http://localhost:3100`                                                             | Existing live application audited by `pnpm test:ui`.                                                                                  |
| `UI_AUDIT_USERNAME` / `UI_AUDIT_PASSWORD` | Unset                                                                               | Credentials enabling authenticated editor and admin UI audit routes.                                                                  |
| `UI_AUDIT_ARTICLE_SLUG`                   | Auto-discovered when possible                                                       | Existing article used for article, editor, history, diff, and modal checks.                                                           |
| `UI_AUDIT_CATEGORY_SLUG`                  | Auto-discovered when possible                                                       | Existing category used for category-detail checks.                                                                                    |

`HOSTNAME` and `PORT` are framework/runtime controls. The Docker image binds `0.0.0.0:3000`; the e2e wrapper supplies its own host and port.

## Production Baselines

Local media on a persistent volume:

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=/app/media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

S3-compatible media:

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NEXTWIKI_MEDIA_DRIVER=s3
NEXTWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NEXTWIKI_S3_REGION=us-east-1
NEXTWIKI_S3_BUCKET=noviqwiki-assets
NEXTWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NEXTWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

Do not use the repository's default Compose PostgreSQL password, published database port, HTTP base URL, or ephemeral-secret fallback as a production security baseline. Create a deployment-specific Compose override or platform configuration.

## Secret Rotation

Rotate `NEXTWIKI_SECRET`, SMTP credentials, and S3 credentials through an intentional maintenance procedure. Rotating `NEXTWIKI_SECRET` invalidates existing sessions as well as outstanding email-verification and password-reset tokens because all are HMAC-protected by that secret. It also changes rate-limit and IP hashes. Coordinate the value across every application instance before resuming traffic.

Production logs and support bundles must not contain passwords, session or CSRF tokens, reset or verification links, access keys, raw cookies, full database URLs with credentials, or uploaded file contents.

---

## 简体中文

> [English](CONFIGURATION.md) | [简体中文](CONFIGURATION.md#简体中文)

NoviqWiki 主要通过环境变量配置；站点级行为则存储在 PostgreSQL 中，并通过初始设置向导或 `/admin/settings` 管理。生产密钥不得进入源代码管理，应由部署平台、Docker secrets 或获批的密钥管理系统注入。

当前环境变量命名空间为 `NEXTWIKI_*`。这是兼容性命名空间，并不代表产品名称发生变化。

### 环境文件

应用和仓库脚本加载环境文件的方式并不完全相同：

- `pnpm dev` 等 Next.js 命令会加载 Next.js 标准环境文件集合，包括 `.env.local`。
- 迁移、种子、搜索重建、备份和恢复等导入 `dotenv/config` 的 TypeScript 运维脚本默认只加载 `.env`，不会加载 `.env.local`。
- Docker Compose 默认插值 shell 变量和 `.env`，不会自动读取 `.env.local`。当前 `compose.yaml` 固定了开发数据库、基础 URL 和本地媒体值，只插值 `NEXTWIKI_SECRET`。

主机开发可先执行：

```bash
cp .env.example .env.local
```

在主机上启动应用前，应修改仅适用于容器的值：

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
NEXTWIKI_MEDIA_ROOT=./media
```

执行运维脚本时，可以在 shell 中导出变量、使用受保护的 `.env`，或明确指定本地文件：

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

若要在 Compose 评估环境中使用持久密钥，请导出该变量或写入未跟踪的 `.env`：

```bash
NEXTWIKI_SECRET="$(openssl rand -base64 32)" docker compose up --build -d
```

切勿提交含真实凭据的文件。运行时配置在进程中有缓存，修改后必须重启应用。

### 核心运行时变量

| 变量                    | 默认值                                                 | 生产环境说明                                                                                                                                        |
| ----------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `postgres://nextwiki:nextwiki@localhost:5432/nextwiki` | 明确设置 PostgreSQL URL。仅容器在 Compose 网络内使用 `db`；主机通过默认端口映射访问时使用 `localhost`。                                             |
| `NEXTWIKI_BASE_URL`     | `http://localhost:3000`                                | 设置外部可见的 HTTPS 源。它提供初始设置默认值和恢复邮件回退值。完成设置后，站点设置中保存的基础 URL 才是权威值，也必须通过 `/admin/settings` 更新。 |
| `NEXTWIKI_SECRET`       | 非生产环境使用仅限开发的回退值                         | `NODE_ENV=production` 的运行时必须设置；当前校验要求至少 32 个字符。所有实例和重启之间必须保持一致。                                                |
| `NODE_ENV`              | 应用架构默认为 `development`                           | 使用 Next.js 或运行时设置的值。生产镜像设置为 `production`；生产环境会启用安全的会话与 CSRF Cookie。                                                |
| `NEXTWIKI_DB_POOL_SIZE` | `10`                                                   | 每个应用进程的 PostgreSQL 最大连接数。应设置正整数，并确保“实例数 × 池大小”低于提供商限制。                                                         |
| `NEXTWIKI_LOG_LEVEL`    | `info`                                                 | 使用项目日志记录器的代码所采用的 Pino 日志级别，例如 `debug`、`info`、`warn` 或 `error`。                                                           |

生成密钥：

```bash
openssl rand -base64 32
```

生成值长度超过当前 32 字符的最低要求。生产环境不要使用示例开发密钥。

### 本地与 S3 媒体存储

| 变量                            | 默认值                                        | 说明                                                                                                                         |
| ------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_MEDIA_DRIVER`         | `local`                                       | 运行时存储后端：`local` 或 `s3`。环境变量决定实际适配器。                                                                    |
| `NEXTWIKI_MEDIA_ROOT`           | 代码中为 `./media`；Compose 中为 `/app/media` | 本地媒体文件系统目录。生产环境必须使用持久化挂载卷。                                                                         |
| `NEXTWIKI_STORAGE_PUBLIC_PATH`  | `/media`                                      | 保存本地媒体 URL 的前缀。除非部署同时提供匹配的应用路由或反向代理重写，否则保持 `/media`；仓库当前路由为 `/media/[...key]`。 |
| `NEXTWIKI_S3_ENDPOINT`          | 无                                            | 兼容 S3 的端点。当前 `s3` 校验即使在 AWS 部署中也要求显式设置。                                                              |
| `NEXTWIKI_S3_REGION`            | `us-east-1`                                   | 存储桶区域。                                                                                                                 |
| `NEXTWIKI_S3_BUCKET`            | 无                                            | 上传媒体所用存储桶，`s3` 驱动必填。                                                                                          |
| `NEXTWIKI_S3_ACCESS_KEY_ID`     | 无                                            | 静态存储访问密钥，当前 `s3` 驱动必填。                                                                                       |
| `NEXTWIKI_S3_SECRET_ACCESS_KEY` | 无                                            | 静态存储密钥，当前 `s3` 驱动必填。                                                                                           |

当前 S3 客户端使用路径样式请求和显式静态凭据，没有会话令牌环境变量，也不会使用默认 AWS 凭据提供链。生产前必须确认所选提供商的兼容性。

S3 对象通过一小时有效的签名 GET URL 获取。应使用私有存储桶、最小权限凭据、提供商侧加密和存储桶版本控制。对象存储必须纳入备份与恢复演练；`pnpm backup` 不会复制 S3 对象。

上传大小和 MIME 允许列表属于站点设置，通过 `/admin/settings` 管理，而不是环境变量。数据库默认上限为 5 MiB（`5242880` 字节）。默认 MIME 列表为 `image/png`、`image/jpeg`、`image/gif`、`image/webp` 和 `application/pdf`；SVG 始终被拒绝。当前 Next.js Server Action 请求体限制为 `10mb`，因此将站点设置为更大值也无法让 Server Action 接受超过框架限制的请求体。

### 邮件

邮件投递为可选功能。没有 SMTP 时仍可创建密码重置和邮箱验证令牌，但只有同时设置两个变量时应用才会发送相应邮件。

| 变量                  | 示例                                    | 说明                                                   |
| --------------------- | --------------------------------------- | ------------------------------------------------------ |
| `NEXTWIKI_SMTP_URL`   | `smtp://user:pass@smtp.example.com:587` | Nodemailer SMTP 连接 URL。必要时对凭据进行百分号编码。 |
| `NEXTWIKI_EMAIL_FROM` | `NoviqWiki <no-reply@example.com>`      | 系统邮件发件人。                                       |

完成初始设置后，恢复链接使用站点设置中保存的基础 URL；只有不存在站点设置时才回退到 `NEXTWIKI_BASE_URL`。配置变更后应验证邮件投递和链接来源。

### 备份与恢复变量

以下变量由仓库脚本使用，而不是 Web 运行时使用：

| 变量                       | 默认值或必填值     | 说明                                                      |
| -------------------------- | ------------------ | --------------------------------------------------------- |
| `NEXTWIKI_BACKUP_DIR`      | `backups`          | `pnpm backup` 使用的输出目录。                            |
| `NEXTWIKI_RESTORE_SQL`     | 恢复时必填         | `pnpm restore` 读取的纯 SQL 文件路径。                    |
| `NEXTWIKI_RESTORE_MEDIA`   | 可选               | 使用本地驱动时，在恢复期间解压的本地媒体 `.tar.gz` 归档。 |
| `NEXTWIKI_RESTORE_CONFIRM` | 必须等于 `restore` | 确认 `pnpm restore` 将执行破坏性的架构重置。              |

执行任一命令前请阅读 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)。

### 开发与测试变量

| 变量                                      | 默认值                                                                            | 说明                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_ALLOWED_DEV_ORIGINS`            | 空                                                                                | 以逗号分隔的主机列表，加入 Next.js `allowedDevOrigins`，供开发服务器进行局域网或移动设备检查。            |
| `NEXTWIKI_E2E_DATABASE_URL`               | 安全的现有测试 URL，或 `postgres://nextwiki:nextwiki@localhost:5432/nextwiki_e2e` | `pnpm test:e2e` 会重置的可丢弃真实 PostgreSQL 数据库。数据库名必须包含独立的 `test`、`e2e` 或 `ci` 标记。 |
| `NEXTWIKI_E2E_MEDIA_ROOT`                 | `test-results/e2e-media`                                                          | e2e 服务器使用的本地媒体目录。                                                                            |
| `PLAYWRIGHT_PORT`                         | `3101`                                                                            | e2e 服务器端口。                                                                                          |
| `PLAYWRIGHT_BASE_URL`                     | `http://127.0.0.1:<PLAYWRIGHT_PORT>`                                              | Playwright 目标 URL。                                                                                     |
| `NEXTWIKI_E2E_SKIP_BUILD`                 | 未设置                                                                            | 仅在已经存在兼容 `.next` 构建时设置为 `1`。                                                               |
| `NEXTWIKI_E2E_REUSE_SERVER`               | 未设置                                                                            | 设置为 `1` 允许 Playwright 复用现有 e2e 服务器。                                                          |
| `NEXTWIKI_E2E_SERVER_MODE`                | `start`                                                                           | 仅在明确需要开发服务器 e2e 时使用 `dev`。                                                                 |
| `UI_AUDIT_BASE_URL`                       | `http://localhost:3100`                                                           | `pnpm test:ui` 审计的现有运行中应用。                                                                     |
| `UI_AUDIT_USERNAME` / `UI_AUDIT_PASSWORD` | 未设置                                                                            | 启用已登录编辑器和管理路由审计的凭据。                                                                    |
| `UI_AUDIT_ARTICLE_SLUG`                   | 尽可能自动发现                                                                    | 用于文章、编辑器、历史、差异和模态框检查的现有文章。                                                      |
| `UI_AUDIT_CATEGORY_SLUG`                  | 尽可能自动发现                                                                    | 用于分类详情检查的现有分类。                                                                              |

`HOSTNAME` 和 `PORT` 是框架或运行时控制项。Docker 镜像绑定 `0.0.0.0:3000`；e2e 包装脚本会提供自己的主机和端口。

### 生产环境基线

持久化卷上的本地媒体：

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=/app/media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

兼容 S3 的媒体：

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NEXTWIKI_MEDIA_DRIVER=s3
NEXTWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NEXTWIKI_S3_REGION=us-east-1
NEXTWIKI_S3_BUCKET=noviqwiki-assets
NEXTWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NEXTWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

不要将仓库默认的 Compose PostgreSQL 密码、公开的数据库端口、HTTP 基础 URL 或临时密钥回退机制视为生产安全基线。应创建部署专用 Compose 覆盖文件或平台配置。

### 密钥轮换

应通过有计划的维护流程轮换 `NEXTWIKI_SECRET`、SMTP 凭据和 S3 凭据。轮换 `NEXTWIKI_SECRET` 会使现有会话以及尚未使用的邮箱验证和密码重置令牌失效，因为它们都由该密钥进行 HMAC 保护；限流和 IP 哈希也会改变。恢复流量前，应在所有应用实例上协调一致的新值。

生产日志和支持包不得包含密码、会话或 CSRF 令牌、重置或验证链接、访问密钥、原始 Cookie、含凭据的完整数据库 URL 或上传文件内容。
