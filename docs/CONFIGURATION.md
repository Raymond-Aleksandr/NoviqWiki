# NoviqWiki Configuration

> [English](CONFIGURATION.md) | [简体中文](CONFIGURATION.md#简体中文)

NoviqWiki is configured primarily through environment variables, with site-level behavior stored in PostgreSQL and managed through the setup wizard or `/admin/settings`. Keep production secrets out of source control and inject them through the deployment platform, Docker secrets, or an approved secret manager.

The canonical environment-variable namespace is `NOVIQWIKI_*`, matching the NoviqWiki product name. Provisional prefixes from earlier draft checkouts are not accepted; see [NoviqWiki identifier migration](./UPGRADING.md#noviqwiki-identifier-migration) before upgrading retained deployments.

## Environment Files

The application and the repository scripts do not load environment files in exactly the same way:

- Next.js commands such as `pnpm dev` load the standard Next.js environment-file set, including `.env.local`.
- TypeScript operational scripts that import `dotenv/config`—migrations, seed, search reindex, backup, and restore—load `.env` by default, not `.env.local`.
- Docker Compose interpolates shell variables and `.env` by default. It does not automatically read `.env.local`. The supplied `compose.yaml` fails closed unless `DATABASE_URL`, `POSTGRES_PASSWORD`, `NOVIQWIKI_BASE_URL`, and `NOVIQWIKI_SECRET` are explicitly configured.

For host development, start with:

```bash
cp .env.example .env.local
```

Then change container-only values before running the app on the host:

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki
NOVIQWIKI_MEDIA_ROOT=./media
```

For an operational script, either export the variables in the shell, keep a protected `.env`, or explicitly select the local file:

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

For a Compose evaluation, validate without rendering resolved environment values, then start the services:

```bash
docker compose config --quiet
docker compose up --build -d
```

Plain `docker compose config` prints resolved values and can disclose secrets in terminals, logs, or review artifacts. Export the required values or place them in an untracked `.env` before validation and startup; production secrets are never generated implicitly.

Never commit a file containing real credentials. Restart the application after changing runtime configuration because environment values are cached in-process.

## Core Runtime Variables

| Variable                 | Default                                                   | Production guidance                                                                                                                                                                                                                                                                     |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | `postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki` | Set an explicit single-host PostgreSQL URL. Use `db` only from a container on the Compose network; use `localhost` from the host. Credentials with reserved characters must be URL-encoded. Backup and restore reject target/credential query overrides and keep passwords out of argv. |
| `NOVIQWIKI_BASE_URL`     | `http://localhost:3000`                                   | Canonical HTTP(S) origin used for request validation, redirects, citations, and email links. In production this environment value is authoritative even if PostgreSQL contains an older setup value; use HTTPS in production.                                                           |
| `NOVIQWIKI_SECRET`       | Development-only code default outside production          | Stable secret for sessions and security-sensitive signing. Production and Compose require at least 32 characters and never generate it implicitly.                                                                                                                                      |
| `NOVIQWIKI_SETUP_TOKEN`  | Unset outside initial setup                               | Separate one-time deployment token required to claim an uninitialized production instance. Remove it and restart after setup.                                                                                                                                                           |
| `NODE_ENV`               | `development` in the application schema                   | Use the value set by Next.js or the runtime. Production requires an HTTPS canonical base URL and secure session/CSRF cookies; local HTTP development may use non-secure cookies.                                                                                                        |
| `NOVIQWIKI_DB_POOL_SIZE` | `10`                                                      | Maximum PostgreSQL connections per application process. Set a positive integer and budget `instances × pool size` below the provider limit.                                                                                                                                             |
| `NOVIQWIKI_LOG_LEVEL`    | `info`                                                    | Pino log level used by code that emits through the project logger, for example `debug`, `info`, `warn`, or `error`.                                                                                                                                                                     |

Generate a secret with:

```bash
openssl rand -hex 32
```

The generated value is longer than the current 32-character minimum. Generate a separate `NOVIQWIKI_SETUP_TOKEN` the same way, enter it in the initial setup wizard, then remove the variable and restart after setup completes.

Use the Compose service host `db` when the application runs inside Docker Compose. Use `localhost` when running `pnpm dev` directly on the host against a Compose-managed PostgreSQL port.

The supplied Compose file requires `DATABASE_URL` directly and does not construct it from
`POSTGRES_PASSWORD`. Keep the raw database password and the URL password component consistent. If
credentials contain reserved URL characters, percent-encode them only in `DATABASE_URL` (for
example, `@` becomes `%40`).

## Reverse Proxy Trust

| Variable                       | Default   | Description                                                                                                            |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NOVIQWIKI_TRUSTED_PROXY_HOPS` | _(unset)_ | Number of trusted reverse-proxy hops in `X-Forwarded-For` (1-16). Leave unset unless every request crosses those hops. |

NoviqWiki ignores `X-Forwarded-For` for source-based authentication rate limits by default because clients can forge that header. Set `NOVIQWIKI_TRUSTED_PROXY_HOPS` only when the application port is not directly reachable by untrusted clients and each trusted proxy overwrites or appends the address of its immediate peer. For one trusted proxy, use `1`; for an edge proxy followed by an internal proxy, use `2`. Invalid or incomplete IP chains do not create a source bucket; account and global authentication limits remain active.

## Setup Modes and Network Isolation

The public `/setup` route derives one of three modes from PostgreSQL:

| Mode       | Database state                        | Behavior                                                                                                                      |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `initial`  | No site exists                        | Shows the full site-configuration and first-Owner workflow.                                                                   |
| `owner`    | A site exists but has no active Owner | Shows only Owner recovery/bootstrap. It preserves the existing site, settings, users, pages, revisions, and media references. |
| `complete` | The site has an active Owner          | Setup is closed and `/setup` redirects away.                                                                                  |

Keep the application or `/setup` isolated from untrusted networks until a trusted administrator completes setup. This is especially critical after restoring or preloading a site with no active Owner: public registration remains blocked, but any visitor who can reach `/setup` can recover the Owner role while `owner` mode is open.

## Local and S3 Media Storage

| Variable                         | Default                                    | Description                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NOVIQWIKI_MEDIA_DRIVER`         | `local`                                    | Runtime storage backend: `local` or `s3`. The environment value controls the active adapter.                                                                                                     |
| `NOVIQWIKI_MEDIA_ROOT`           | `./media` in code; `/app/media` in Compose | Filesystem directory for local media. Use a persistent mounted volume in production.                                                                                                             |
| `NOVIQWIKI_STORAGE_PUBLIC_PATH`  | `/media`                                   | URL prefix stored for local media. Keep `/media` unless the deployment also provides a matching application route or reverse-proxy rewrite; the repository route is currently `/media/[...key]`. |
| `NOVIQWIKI_S3_ENDPOINT`          | None                                       | S3-compatible endpoint. The current `s3` validation requires it, including for AWS deployments.                                                                                                  |
| `NOVIQWIKI_S3_REGION`            | `us-east-1`                                | Bucket region.                                                                                                                                                                                   |
| `NOVIQWIKI_S3_BUCKET`            | None                                       | Bucket for uploaded media. Required with the `s3` driver.                                                                                                                                        |
| `NOVIQWIKI_S3_ACCESS_KEY_ID`     | None                                       | Static storage access key. Required with the current `s3` driver.                                                                                                                                |
| `NOVIQWIKI_S3_SECRET_ACCESS_KEY` | None                                       | Static storage secret. Required with the current `s3` driver.                                                                                                                                    |

The current S3 client uses path-style requests and explicit static credentials. It does not expose an environment variable for a session token or rely on the default AWS credential-provider chain. Confirm compatibility with the selected provider before production use.

Local and S3 media always use the authorized same-origin `/media/{key}` streaming route without persisting or exposing signed URLs. Public-site responses use `Cache-Control: public, max-age=0, must-revalidate`; private-site responses use `private, no-store`. Use a private bucket, least-privilege credentials, provider-side encryption, and bucket versioning. Grant `.noviqwiki-readiness/` read/write/delete access; both adapters perform real write/read/delete probes and reject unsafe local roots. Include the object store in backup/restore drills; `pnpm backup` does not copy S3 objects.

Upload size and MIME allowlists are site settings managed at `/admin/settings`, not environment variables. The database default is 5 MiB (`5242880` bytes). The default MIME allowlist is `image/png`, `image/jpeg`, `image/gif`, `image/webp`, and `application/pdf`; SVG is always rejected. The current Next.js Server Action body limit is `10mb`, so a larger site setting cannot make a Server Action accept a body above that framework limit.

## Email

Email is optional. Password reset and email verification links are created by the application; delivery requires SMTP configuration. Setup and site settings reject the `email_verification` registration mode unless both SMTP variables below are configured, and registration also rejects an unsafe legacy configuration before creating a pending account. Pending users can request another verification message from `/resend-verification`. The public response is deliberately identical for matching and non-matching accounts. A failed resend never supersedes an older usable verification link; after restoring SMTP, retry the resend form.

| Variable               | Example                                 | Description                                                               |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| `NOVIQWIKI_SMTP_URL`   | `smtp://user:pass@smtp.example.com:587` | Nodemailer SMTP connection URL. Percent-encode credentials when required. |
| `NOVIQWIKI_EMAIL_FROM` | `NoviqWiki <no-reply@example.com>`      | Sender for system email.                                                  |

In production, recovery and verification links use the deployment-authoritative `NOVIQWIKI_BASE_URL`; the stored site value is only a development/test fallback. Validate delivery and link origins after configuration changes.

## Backup and Restore Variables

These variables are consumed by repository scripts rather than by the web runtime:

| Variable                     | Default or required value               | Description                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NOVIQWIKI_BACKUP_DIR`       | `backups`                               | Output directory used by `pnpm backup`; new directories use mode `0700` and generated files use `0600`. Protect a pre-existing custom directory with `0700` or stricter permissions. With local media, it must resolve outside `NOVIQWIKI_MEDIA_ROOT`. |
| `NOVIQWIKI_BACKUP_QUIESCED`  | Required for non-Compose local media    | Explicit acknowledgement that all application writers have been stopped before a database-plus-local-media backup.                                                                                                                                     |
| `NOVIQWIKI_RESTORE_SQL`      | Required for restore                    | Readable, non-empty NoviqWiki plain-text `pg_dump` consumed by `pnpm restore`.                                                                                                                                                                         |
| `NOVIQWIKI_RESTORE_MEDIA`    | Optional                                | Local-media `.tar.gz` archive preflighted for safe member paths and regular-file/directory members only, then extracted only with the local driver.                                                                                                    |
| `NOVIQWIKI_RESTORE_CONFIRM`  | Target-bound value required for restore | Exact value printed by the command, binding the parsed database user, host, port, database, and—when restoring media—the percent-encoded canonical media root.                                                                                         |
| `NOVIQWIKI_RESTORE_QUIESCED` | Required for non-Compose local media    | Explicit acknowledgement that application writes are stopped before a non-Compose local-media restore.                                                                                                                                                 |

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) before running either command.

The scripts strictly parse the PostgreSQL target, remove ambient libpq routing overrides, and keep passwords out of child-process arguments. The exact Compose `noviqwiki@db:5432/noviqwiki` target uses container tools; every other target requires local PostgreSQL clients, with no fallback to another database after failure. Local-media paths must be dedicated, non-linked directories outside home/workspace ancestors. Backup removes both partial outputs on failure. Restore stages and validates SQL and safe tar members before mutation, runs schema reset and import in one fail-fast transaction, promotes media with the previous tree retained, and restores the old media tree if SQL fails. Compose automatically stops/restarts the app; other local-media deployments require explicit quiescence acknowledgement. `pnpm backup` copies neither S3 objects nor deployment secrets.

## Development and Test Variables

| Variable                                  | Default                                                                                | Description                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NOVIQWIKI_ALLOWED_DEV_ORIGINS`           | Empty                                                                                  | Comma-separated hosts appended to Next.js `allowedDevOrigins` for LAN/mobile checks with the development server.                      |
| `NOVIQWIKI_E2E_DATABASE_URL`              | Safe ambient test URL or `postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki_e2e` | Disposable real PostgreSQL database reset by `pnpm test:e2e`. Its database name must contain a separate `test`, `e2e`, or `ci` token. |
| `NOVIQWIKI_E2E_MEDIA_ROOT`                | `test-results/e2e-media`                                                               | Local media directory used by the e2e server.                                                                                         |
| `PLAYWRIGHT_PORT`                         | `3101`                                                                                 | Port used by the e2e server.                                                                                                          |
| `PLAYWRIGHT_BASE_URL`                     | `http://127.0.0.1:<PLAYWRIGHT_PORT>`                                                   | Playwright target URL.                                                                                                                |
| `NOVIQWIKI_E2E_SKIP_BUILD`                | Unset                                                                                  | Set to `1` only when a compatible `.next` build already exists.                                                                       |
| `NOVIQWIKI_E2E_REUSE_SERVER`              | Unset                                                                                  | Set to `1` to let Playwright reuse an existing e2e server.                                                                            |
| `NOVIQWIKI_E2E_SERVER_MODE`               | `start`                                                                                | Use `dev` only for a deliberate development-server e2e run.                                                                           |
| `UI_AUDIT_BASE_URL`                       | `http://localhost:3100`                                                                | Existing live application audited by `pnpm test:ui`.                                                                                  |
| `UI_AUDIT_USERNAME` / `UI_AUDIT_PASSWORD` | Unset                                                                                  | Credentials enabling authenticated editor and admin UI audit routes.                                                                  |
| `UI_AUDIT_ARTICLE_SLUG`                   | Auto-discovered when possible                                                          | Existing article used for article, editor, history, diff, and modal checks.                                                           |
| `UI_AUDIT_CATEGORY_SLUG`                  | Auto-discovered when possible                                                          | Existing category used for category-detail checks.                                                                                    |

`HOSTNAME` and `PORT` are framework/runtime controls. The Docker image binds `0.0.0.0:3000`; the e2e wrapper supplies its own host and port.

## Production Baselines

Local media on a persistent volume:

```bash
NODE_ENV=production
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki
NOVIQWIKI_BASE_URL=https://wiki.example.com
NOVIQWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NOVIQWIKI_SETUP_TOKEN=replace-with-separate-one-time-token
NOVIQWIKI_MEDIA_DRIVER=local
NOVIQWIKI_MEDIA_ROOT=/app/media
NOVIQWIKI_STORAGE_PUBLIC_PATH=/media
```

S3-compatible media:

```bash
NODE_ENV=production
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki
NOVIQWIKI_BASE_URL=https://wiki.example.com
NOVIQWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NOVIQWIKI_MEDIA_DRIVER=s3
NOVIQWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NOVIQWIKI_S3_REGION=us-east-1
NOVIQWIKI_S3_BUCKET=noviqwiki-assets
NOVIQWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NOVIQWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

Omit `NOVIQWIKI_TRUSTED_PROXY_HOPS` when the application is exposed directly or the proxy chain is not fixed and trusted. If local media storage is used in production, `NOVIQWIKI_MEDIA_ROOT` must point at persistent storage, not an ephemeral container filesystem. Remove `NOVIQWIKI_SETUP_TOKEN` after the first Owner is created.

## Secret Rotation

Rotate `NOVIQWIKI_SECRET`, SMTP credentials, and S3 credentials through an intentional maintenance procedure. Rotating `NOVIQWIKI_SECRET` invalidates existing sessions as well as outstanding email-verification and password-reset tokens because all are HMAC-protected by that secret. It also changes rate-limit and IP hashes. Coordinate the value across every application instance before resuming traffic.

Production logs and support bundles must not contain passwords, session or CSRF tokens, reset or verification links, access keys, raw cookies, full database URLs with credentials, or uploaded file contents.

---

## 简体中文

> [English](CONFIGURATION.md) | [简体中文](CONFIGURATION.md#简体中文)

NoviqWiki 主要通过环境变量配置；站点级行为则存储在 PostgreSQL 中，并通过初始设置向导或 `/admin/settings` 管理。生产密钥不得进入源代码管理，应由部署平台、Docker secrets 或获批的密钥管理系统注入。

规范环境变量命名空间为 `NOVIQWIKI_*`，与 NoviqWiki 产品名称一致。更早草稿检出的临时前缀不再接受；升级保留数据的部署前，请阅读 [NoviqWiki 标识迁移](./UPGRADING.md#noviqwiki-标识迁移)。

### 环境文件

应用和仓库脚本加载环境文件的方式并不完全相同：

- `pnpm dev` 等 Next.js 命令会加载 Next.js 标准环境文件集合，包括 `.env.local`。
- 迁移、种子、搜索重建、备份和恢复等导入 `dotenv/config` 的 TypeScript 运维脚本默认只加载 `.env`，不会加载 `.env.local`。
- Docker Compose 默认插值 shell 变量和 `.env`，不会自动读取 `.env.local`。当前 `compose.yaml` 在缺少 `DATABASE_URL`、`POSTGRES_PASSWORD`、`NOVIQWIKI_BASE_URL` 或 `NOVIQWIKI_SECRET` 时会立即失败。

主机开发可先执行：

```bash
cp .env.example .env.local
```

在主机上启动应用前，应修改仅适用于容器的值：

```bash
DATABASE_URL=postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki
NOVIQWIKI_MEDIA_ROOT=./media
```

执行运维脚本时，可以在 shell 中导出变量、使用受保护的 `.env`，或明确指定本地文件：

```bash
DOTENV_CONFIG_PATH=.env.local pnpm db:migrate
```

在 Compose 评估环境中，应先在不渲染解析后环境变量值的情况下进行验证，再启动服务：

```bash
docker compose config --quiet
docker compose up --build -d
```

普通的 `docker compose config` 会输出解析后的值，可能在终端、日志或审查材料中泄露密钥。验证与启动前应导出必填值或写入未跟踪的 `.env`；生产密钥不会被隐式生成。

切勿提交含真实凭据的文件。运行时配置在进程中有缓存，修改后必须重启应用。

### 核心运行时变量

| 变量                     | 默认值                                                    | 生产环境说明                                                                                                                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | `postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki` | 明确设置单一主机 PostgreSQL URL。仅容器在 Compose 网络内使用 `db`；主机通过默认端口映射访问时使用 `localhost`。备份和恢复会拒绝覆盖目标/凭据的查询参数，把省略端口规范为 `5432`，清除环境中的 libpq 路由变量，并通过临时受保护 passfile 而不是 argv 传递 URL 密码。 |
| `NOVIQWIKI_BASE_URL`     | `http://localhost:3000`                                   | 请求校验、重定向、引用和邮件链接使用的规范 HTTP(S) 源。生产环境中该部署变量为权威值，即使 PostgreSQL 中仍有旧设置值；生产必须使用 HTTPS。                                                                                                                           |
| `NOVIQWIKI_SECRET`       | 非生产环境使用仅限开发的代码默认值                        | 会话和安全签名使用的稳定密钥。生产 Web 与 Compose 要求至少 32 个字符，且不会隐式生成。                                                                                                                                                                              |
| `NOVIQWIKI_SETUP_TOKEN`  | 初始设置之外不设置                                        | 未初始化生产实例创建首位 Owner 时使用的一次性部署令牌；完成设置后移除并重启。                                                                                                                                                                                       |
| `NODE_ENV`               | 应用架构默认为 `development`                              | 使用 Next.js 或运行时设置的值。生产环境要求 HTTPS 规范基础 URL 与安全的会话/CSRF Cookie；本地 HTTP 开发可使用非安全 Cookie。                                                                                                                                        |
| `NOVIQWIKI_DB_POOL_SIZE` | `10`                                                      | 每个应用进程的 PostgreSQL 最大连接数。应设置正整数，并确保“实例数 × 池大小”低于提供商限制。                                                                                                                                                                         |
| `NOVIQWIKI_LOG_LEVEL`    | `info`                                                    | 使用项目日志记录器的代码所采用的 Pino 日志级别，例如 `debug`、`info`、`warn` 或 `error`。                                                                                                                                                                           |

生成密钥：

```bash
openssl rand -hex 32
```

生成值长度超过当前 32 字符的最低要求。应以相同方式单独生成 `NOVIQWIKI_SETUP_TOKEN`，在初始化向导中输入，首位 Owner 创建后移除该变量并重启。

### 设置模式与网络隔离

公共 `/setup` 路由根据 PostgreSQL 得出以下三种模式之一：

| 模式       | 数据库状态                 | 行为                                                                     |
| ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `initial`  | 不存在站点                 | 显示完整的站点配置与首位 Owner 工作流。                                  |
| `owner`    | 已存在站点但没有活跃 Owner | 仅显示 Owner 恢复/引导；保留现有站点、设置、用户、页面、修订和媒体引用。 |
| `complete` | 站点存在活跃 Owner         | 设置已关闭，访问 `/setup` 会被重定向。                                   |

在可信管理员完成设置前，应将应用或 `/setup` 与不可信网络隔离。恢复或预加载没有活跃 Owner 的站点后，这一点尤其重要：公开注册会保持阻断，但 `owner` 模式开放期间，任何能够访问 `/setup` 的访客仍能恢复 Owner 角色。

### 本地与 S3 媒体存储

| 变量                             | 默认值                                        | 说明                                                                                                                         |
| -------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `NOVIQWIKI_MEDIA_DRIVER`         | `local`                                       | 运行时存储后端：`local` 或 `s3`。环境变量决定实际适配器。                                                                    |
| `NOVIQWIKI_MEDIA_ROOT`           | 代码中为 `./media`；Compose 中为 `/app/media` | 本地媒体文件系统目录。生产环境必须使用持久化挂载卷。                                                                         |
| `NOVIQWIKI_STORAGE_PUBLIC_PATH`  | `/media`                                      | 保存本地媒体 URL 的前缀。除非部署同时提供匹配的应用路由或反向代理重写，否则保持 `/media`；仓库当前路由为 `/media/[...key]`。 |
| `NOVIQWIKI_S3_ENDPOINT`          | 无                                            | 兼容 S3 的端点。当前 `s3` 校验即使在 AWS 部署中也要求显式设置。                                                              |
| `NOVIQWIKI_S3_REGION`            | `us-east-1`                                   | 存储桶区域。                                                                                                                 |
| `NOVIQWIKI_S3_BUCKET`            | 无                                            | 上传媒体所用存储桶，`s3` 驱动必填。                                                                                          |
| `NOVIQWIKI_S3_ACCESS_KEY_ID`     | 无                                            | 静态存储访问密钥，当前 `s3` 驱动必填。                                                                                       |
| `NOVIQWIKI_S3_SECRET_ACCESS_KEY` | 无                                            | 静态存储密钥，当前 `s3` 驱动必填。                                                                                           |

当前 S3 客户端使用路径样式请求和显式静态凭据，没有会话令牌环境变量，也不会使用默认 AWS 凭据提供链。生产前必须确认所选提供商的兼容性。

本地与 S3 媒体始终使用经过授权的同源 `/media/{key}` 流式路由，不持久化或暴露签名 URL。公开站点响应使用 `Cache-Control: public, max-age=0, must-revalidate`，私有站点使用 `private, no-store`。应使用私有存储桶、最小权限凭据、提供商侧加密和版本控制，并为 `.noviqwiki-readiness/` 探针前缀授予读写删除权限；两种适配器都会执行真实写入/读取/删除探针并拒绝不安全的本地根目录。对象存储必须纳入备份恢复演练；`pnpm backup` 不复制 S3 对象。

上传大小和 MIME 允许列表属于站点设置，通过 `/admin/settings` 管理，而不是环境变量。数据库默认上限为 5 MiB（`5242880` 字节）。默认 MIME 列表为 `image/png`、`image/jpeg`、`image/gif`、`image/webp` 和 `application/pdf`；SVG 始终被拒绝。当前 Next.js Server Action 请求体限制为 `10mb`，因此将站点设置为更大值也无法让 Server Action 接受超过框架限制的请求体。

### 邮件

邮件投递为可选功能。密码重置和邮箱验证链接由应用创建，但投递需要完整 SMTP 配置。缺少 SMTP 时，设置与站点配置会拒绝 `email_verification` 注册模式，注册流程也会在创建待验证账户前拒绝遗留的不安全配置。重发页面对存在和不存在的账户返回相同响应；发送失败不会使旧的可用链接失效。

| 变量                   | 示例                                    | 说明                                                   |
| ---------------------- | --------------------------------------- | ------------------------------------------------------ |
| `NOVIQWIKI_SMTP_URL`   | `smtp://user:pass@smtp.example.com:587` | Nodemailer SMTP 连接 URL。必要时对凭据进行百分号编码。 |
| `NOVIQWIKI_EMAIL_FROM` | `NoviqWiki <no-reply@example.com>`      | 系统邮件发件人。                                       |

生产环境中的恢复与验证链接使用部署权威的 `NOVIQWIKI_BASE_URL`；站点存储值仅作为开发或测试回退。配置变更后应验证邮件投递和链接来源。

### 备份与恢复变量

以下变量由仓库脚本使用，而不是 Web 运行时使用：

| 变量                         | 默认值或必填值               | 说明                                                                                                                                                                                 |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NOVIQWIKI_BACKUP_DIR`       | `backups`                    | `pnpm backup` 使用的输出目录；新目录权限为 `0700`，生成文件权限为 `0600`。已存在的自定义目录应保护为 `0700` 或更严格。使用本地媒体时，其真实路径必须位于 `NOVIQWIKI_MEDIA_ROOT` 外。 |
| `NOVIQWIKI_BACKUP_QUIESCED`  | 非 Compose 本地媒体时必填    | 明确确认数据库与本地媒体备份前已停止所有应用写入。                                                                                                                                   |
| `NOVIQWIKI_RESTORE_SQL`      | 恢复时必填                   | `pnpm restore` 读取的可读、非空 NoviqWiki 纯文本 `pg_dump`。                                                                                                                         |
| `NOVIQWIKI_RESTORE_MEDIA`    | 可选                         | 本地媒体 `.tar.gz` 归档；脚本会预检安全成员路径且只接受普通文件和目录，并仅在使用本地驱动时解压。                                                                                    |
| `NOVIQWIKI_RESTORE_CONFIRM`  | 恢复时必须提供与目标绑定的值 | 必须等于命令打印的精确值，并绑定解析后的数据库用户、主机、端口、数据库，以及恢复媒体时经百分号编码的规范媒体根目录。                                                                 |
| `NOVIQWIKI_RESTORE_QUIESCED` | 非 Compose 本地媒体时必填    | 明确确认非 Compose 本地媒体恢复前已停止应用写入。                                                                                                                                    |

执行任一命令前请阅读 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)。

脚本严格解析 PostgreSQL 目标、移除 libpq 路由覆盖，并防止密码进入子进程参数。精确的 Compose `noviqwiki@db:5432/noviqwiki` 目标使用容器工具；其他目标必须安装本地 PostgreSQL 客户端，失败后绝不会切换数据库。本地媒体路径必须是专用、无链接且不属于主目录/工作区祖先的目录。备份失败会删除两个不完整产物。恢复会先暂存并验证 SQL 与安全 tar 成员，通过单一快速失败事务重置和导入 Schema，并保留旧媒体树；SQL 失败时会恢复旧媒体。Compose 会自动停止/重启应用，其他本地媒体部署必须显式确认已静默写入。`pnpm backup` 不复制 S3 对象或部署密钥。

### 开发与测试变量

| 变量                                      | 默认值                                                                               | 说明                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `NOVIQWIKI_ALLOWED_DEV_ORIGINS`           | 空                                                                                   | 以逗号分隔的主机列表，加入 Next.js `allowedDevOrigins`，供开发服务器进行局域网或移动设备检查。            |
| `NOVIQWIKI_E2E_DATABASE_URL`              | 安全的现有测试 URL，或 `postgres://noviqwiki:noviqwiki@localhost:5432/noviqwiki_e2e` | `pnpm test:e2e` 会重置的可丢弃真实 PostgreSQL 数据库。数据库名必须包含独立的 `test`、`e2e` 或 `ci` 标记。 |
| `NOVIQWIKI_E2E_MEDIA_ROOT`                | `test-results/e2e-media`                                                             | e2e 服务器使用的本地媒体目录。                                                                            |
| `PLAYWRIGHT_PORT`                         | `3101`                                                                               | e2e 服务器端口。                                                                                          |
| `PLAYWRIGHT_BASE_URL`                     | `http://127.0.0.1:<PLAYWRIGHT_PORT>`                                                 | Playwright 目标 URL。                                                                                     |
| `NOVIQWIKI_E2E_SKIP_BUILD`                | 未设置                                                                               | 仅在已经存在兼容 `.next` 构建时设置为 `1`。                                                               |
| `NOVIQWIKI_E2E_REUSE_SERVER`              | 未设置                                                                               | 设置为 `1` 允许 Playwright 复用现有 e2e 服务器。                                                          |
| `NOVIQWIKI_E2E_SERVER_MODE`               | `start`                                                                              | 仅在明确需要开发服务器 e2e 时使用 `dev`。                                                                 |
| `UI_AUDIT_BASE_URL`                       | `http://localhost:3100`                                                              | `pnpm test:ui` 审计的现有运行中应用。                                                                     |
| `UI_AUDIT_USERNAME` / `UI_AUDIT_PASSWORD` | 未设置                                                                               | 启用已登录编辑器和管理路由审计的凭据。                                                                    |
| `UI_AUDIT_ARTICLE_SLUG`                   | 尽可能自动发现                                                                       | 用于文章、编辑器、历史、差异和模态框检查的现有文章。                                                      |
| `UI_AUDIT_CATEGORY_SLUG`                  | 尽可能自动发现                                                                       | 用于分类详情检查的现有分类。                                                                              |

`HOSTNAME` 和 `PORT` 是框架或运行时控制项。Docker 镜像绑定 `0.0.0.0:3000`；e2e 包装脚本会提供自己的主机和端口。

### 生产环境基线

持久化卷上的本地媒体：

```bash
NODE_ENV=production
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki
NOVIQWIKI_BASE_URL=https://wiki.example.com
NOVIQWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NOVIQWIKI_SETUP_TOKEN=replace-with-separate-one-time-token
NOVIQWIKI_MEDIA_DRIVER=local
NOVIQWIKI_MEDIA_ROOT=/app/media
NOVIQWIKI_STORAGE_PUBLIC_PATH=/media
```

兼容 S3 的媒体：

```bash
NODE_ENV=production
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki
NOVIQWIKI_BASE_URL=https://wiki.example.com
NOVIQWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NOVIQWIKI_SETUP_TOKEN=replace-with-separate-one-time-token
NOVIQWIKI_MEDIA_DRIVER=s3
NOVIQWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NOVIQWIKI_S3_REGION=us-east-1
NOVIQWIKI_S3_BUCKET=noviqwiki-assets
NOVIQWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NOVIQWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

默认 Compose 保持 PostgreSQL 私有并要求显式密钥，但面向互联网的生产环境仍需 HTTPS、密钥管理、备份、资源限制和镜像固定策略。首位 Owner 创建后应移除 `NOVIQWIKI_SETUP_TOKEN` 并重启。

### 密钥轮换

应通过有计划的维护流程轮换 `NOVIQWIKI_SECRET`、SMTP 凭据和 S3 凭据。轮换 `NOVIQWIKI_SECRET` 会使现有会话以及尚未使用的邮箱验证和密码重置令牌失效，因为它们都由该密钥进行 HMAC 保护；限流和 IP 哈希也会改变。恢复流量前，应在所有应用实例上协调一致的新值。

生产日志和支持包不得包含密码、会话或 CSRF 令牌、重置或验证链接、访问密钥、原始 Cookie、含凭据的完整数据库 URL 或上传文件内容。
