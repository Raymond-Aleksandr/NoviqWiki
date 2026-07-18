# NoviqWiki Configuration

> [English](CONFIGURATION.md) | [简体中文](CONFIGURATION.md#简体中文)

NoviqWiki is configured primarily through environment variables, with site-level behavior stored in PostgreSQL and managed through the setup wizard or `/admin/settings`. Keep production secrets out of source control and inject them through the deployment platform, Docker secrets, or an approved secret manager.

The current environment-variable namespace is `NEXTWIKI_*`. It is a compatibility namespace and does not change the NoviqWiki product name.

## Environment Files

The application and the repository scripts do not load environment files in exactly the same way:

- Next.js commands such as `pnpm dev` load the standard Next.js environment-file set, including `.env.local`.
- TypeScript operational scripts that import `dotenv/config`—migrations, seed, search reindex, backup, and restore—load `.env` by default, not `.env.local`.
- Docker Compose interpolates shell variables and `.env` by default. It does not automatically read `.env.local`. The current `compose.yaml` hard-codes the development database, base URL, and local-media values, interpolates `NEXTWIKI_SECRET`, and mounts the `nextwiki-secrets` named volume for the container startup fallback.

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

For a Compose evaluation, validate without rendering resolved environment values, then start the services:

```bash
docker compose config --quiet
docker compose up --build -d
```

Plain `docker compose config` prints resolved values and can disclose secrets in terminals, logs, or review artifacts. The stock Compose deployment automatically persists a generated secret in `nextwiki-secrets` when `NEXTWIKI_SECRET` is empty. To use an explicit secret instead, export it or place it in an untracked `.env` before validation and startup.

Never commit a file containing real credentials. Restart the application after changing runtime configuration because environment values are cached in-process.

## Core Runtime Variables

| Variable                | Default                                                  | Production guidance                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`          | `postgres://nextwiki:nextwiki@localhost:5432/nextwiki`   | Set an explicit single-host PostgreSQL URL. Use `db` only from a container on the Compose network; use `localhost` from the host. Backup and restore reject target/credential query overrides, normalize an omitted port to `5432`, clear ambient libpq routing variables, and pass a URL password through a temporary protected passfile instead of argv.                                       |
| `NEXTWIKI_BASE_URL`     | `http://localhost:3000`                                  | Set the externally visible HTTPS origin. The environment value alone controls whether session and CSRF cookies receive `Secure`: its URL scheme must be `https:`. It also supplies the setup default and recovery-email fallback. After setup, the stored site URL is authoritative for generated links and must also be updated through `/admin/settings`; it does not control cookie `Secure`. |
| `NEXTWIKI_SECRET`       | Development-only application fallback outside production | The production web runtime requires at least 32 characters. Inject a stable, managed value across every instance and restart; the stock container-only fallback is described below.                                                                                                                                                                                                              |
| `NEXTWIKI_SECRET_DIR`   | `/app/secrets` in the container startup script           | Container-startup control only. When `NEXTWIKI_SECRET` is empty, the script reads or creates `nextwiki-secret` in this directory.                                                                                                                                                                                                                                                                |
| `NODE_ENV`              | `development` in the application schema                  | Use the value set by Next.js or the runtime. The production image sets `production`; this variable does not decide whether cookies receive `Secure`.                                                                                                                                                                                                                                             |
| `NEXTWIKI_DB_POOL_SIZE` | `10`                                                     | Maximum PostgreSQL connections per application process. Set a positive integer and budget `instances × pool size` below the provider limit.                                                                                                                                                                                                                                                      |
| `NEXTWIKI_LOG_LEVEL`    | `info`                                                   | Pino log level used by code that emits through the project logger, for example `debug`, `info`, `warn`, or `error`.                                                                                                                                                                                                                                                                              |

Generate a secret with:

```bash
openssl rand -base64 32
```

The generated value is longer than the current 32-character minimum. Do not use the example development secret in production.

### Container Secret Resolution

The stock image's startup script resolves the application secret in this order:

1. Validate and use a non-empty explicit `NEXTWIKI_SECRET` environment value, then remove any old fallback file.
2. Otherwise, read a non-empty `${NEXTWIKI_SECRET_DIR:-/app/secrets}/nextwiki-secret` file.
3. Otherwise, generate a 32-byte random value, write its hexadecimal representation to that file with restrictive permissions, and export it to the application.

An explicit environment value is validated before any fallback is removed and is never written to the file. Removing the old fallback when a valid explicit value is active prevents that obsolete secret from silently returning later. If the explicit value is subsequently removed, startup generates a new fallback and invalidates existing sessions, email-verification tokens, password-reset tokens, rate-limit hashes, and IP hashes. The entrypoint rejects a symlink secret directory and non-regular, empty, or differently owned fallback files; it corrects a reusable file to mode `0600`. The stock Compose file mounts `nextwiki-secrets` at `/app/secrets`, so a generated fallback survives container recreation and `docker compose down` while fallback mode remains active; `docker compose down -v` deletes that volume.

`pnpm backup` does not include `nextwiki-secrets`. Automatic generation is convenient for local evaluation, but production deployments should inject `NEXTWIKI_SECRET` from a secret manager and make missing managed configuration a deployment failure. If a platform deliberately uses a secret file instead, it must manage that file's access, backup, restore, and cross-instance consistency outside the repository script.

## Setup Modes and Network Isolation

The public `/setup` route derives one of three modes from PostgreSQL:

| Mode       | Database state                                 | Behavior                                                                                                                |
| ---------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `initial`  | No site exists                                 | Shows the full site-configuration and first-Owner workflow.                                                             |
| `owner`    | A site exists and the total user count is zero | Shows only the first-Owner bootstrap. It preserves the existing site, settings, pages, revisions, and media references. |
| `complete` | At least one user exists                       | Setup is closed and `/setup` redirects away.                                                                            |

Keep the application or `/setup` isolated from untrusted networks until a trusted administrator completes setup. This is especially critical after restoring or preloading a database that contains a site but zero users: public registration remains blocked, but any visitor who can reach `/setup` can claim the first Owner account while `owner` mode is open.

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

| Variable                    | Default or required value               | Description                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_BACKUP_DIR`       | `backups`                               | Output directory used by `pnpm backup`; new directories use mode `0700` and generated files use `0600`. Protect a pre-existing custom directory with `0700` or stricter permissions. With local media, it must resolve outside `NEXTWIKI_MEDIA_ROOT`. |
| `NEXTWIKI_COMPOSE_FALLBACK` | Unset; only `1` opts in                 | Permits only the anchored `compose:default/noviqwiki/db/nextwiki` target when host `pg_dump` or `psql` is unavailable. It never handles credential, connectivity, SQL, or other non-zero failures and ignores `DATABASE_URL`.                         |
| `NEXTWIKI_RESTORE_SQL`      | Required for restore                    | Readable, non-empty NoviqWiki plain-text `pg_dump` consumed by `pnpm restore`.                                                                                                                                                                        |
| `NEXTWIKI_RESTORE_MEDIA`    | Optional                                | Local-media `.tar.gz` archive preflighted for safe member paths and regular-file/directory members only, then extracted only with the local driver.                                                                                                   |
| `NEXTWIKI_RESTORE_CONFIRM`  | Target-bound value required for restore | Must equal `restore:<host>:<port>/<database>` for `DATABASE_URL` (an omitted port becomes `5432`), or exactly `restore:compose:default/noviqwiki/db/nextwiki` for the opted-in Compose target.                                                        |

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) before running either command.

The backup and restore scripts load `.env` through `dotenv/config`, but each reads only its own database, media, and backup or restore variables. They do not run the web application's complete environment validation and do not require `NEXTWIKI_SECRET`; they strictly parse the resolved PostgreSQL target, remove ambient libpq route overrides, and keep a URL password out of child-process arguments. The fixed Compose fallback clears project/file/host/context overrides and anchors the repository file, Docker `default` context, and `noviqwiki` project. With local media, backup requires an existing dedicated safe `NEXTWIKI_MEDIA_ROOT` instead of creating a missing source, and its resolved output directory cannot be inside that media tree. A media-archive failure removes both outputs from that uniquely named backup run. Restore validates the complete NoviqWiki plain SQL, safe tar members and types, and selected database target before it accepts the target-bound confirmation; it then validates a writable media destination and SQL file identity before sending the schema reset and import through one fail-fast transaction. Database and media restoration remain cross-resource and non-atomic. `pnpm backup` copies neither S3 objects nor the container `nextwiki-secrets` volume. Protect those assets through separate provider or platform procedures.

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

Do not use the repository's default Compose PostgreSQL password, published database port, HTTP base URL, or automatically generated `NEXTWIKI_SECRET` persisted in the `nextwiki-secrets` volume as a production security baseline. The generated volume-backed secret is an evaluation convenience. Create a deployment-specific Compose override or platform configuration that requires a managed secret.

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
- Docker Compose 默认插值 shell 变量和 `.env`，不会自动读取 `.env.local`。当前 `compose.yaml` 固定了开发数据库、基础 URL 和本地媒体值，插值 `NEXTWIKI_SECRET`，并为容器启动回退挂载 `nextwiki-secrets` 命名卷。

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

在 Compose 评估环境中，应先在不渲染解析后环境变量值的情况下进行验证，再启动服务：

```bash
docker compose config --quiet
docker compose up --build -d
```

普通的 `docker compose config` 会输出解析后的值，可能在终端、日志或审查材料中泄露密钥。`NEXTWIKI_SECRET` 为空时，原始 Compose 部署会自动将生成的密钥持久化到 `nextwiki-secrets`。若要改用显式密钥，请在验证与启动前导出该变量或写入未跟踪的 `.env`。

切勿提交含真实凭据的文件。运行时配置在进程中有缓存，修改后必须重启应用。

### 核心运行时变量

| 变量                    | 默认值                                                 | 生产环境说明                                                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | `postgres://nextwiki:nextwiki@localhost:5432/nextwiki` | 明确设置单一主机 PostgreSQL URL。仅容器在 Compose 网络内使用 `db`；主机通过默认端口映射访问时使用 `localhost`。备份和恢复会拒绝覆盖目标/凭据的查询参数，把省略端口规范为 `5432`，清除环境中的 libpq 路由变量，并通过临时受保护 passfile 而不是 argv 传递 URL 密码。    |
| `NEXTWIKI_BASE_URL`     | `http://localhost:3000`                                | 设置外部可见的 HTTPS 源。只有该环境变量值决定会话与 CSRF Cookie 是否带有 `Secure`：其 URL 协议必须为 `https:`。它还提供初始设置默认值和恢复邮件回退值。完成设置后，站点存储的 URL 是生成链接的权威值，也必须通过 `/admin/settings` 更新；它不控制 Cookie 的 `Secure`。 |
| `NEXTWIKI_SECRET`       | 非生产环境使用仅限开发的应用回退值                     | 生产 Web 运行时要求至少 32 个字符。应向每个实例注入稳定的托管值并重启；原始容器专用的回退机制见下文。                                                                                                                                                                  |
| `NEXTWIKI_SECRET_DIR`   | 容器启动脚本中为 `/app/secrets`                        | 仅控制容器启动。`NEXTWIKI_SECRET` 为空时，脚本读取或创建该目录中的 `nextwiki-secret`。                                                                                                                                                                                 |
| `NODE_ENV`              | 应用架构默认为 `development`                           | 使用 Next.js 或运行时设置的值。生产镜像设置为 `production`；该变量不决定 Cookie 是否带有 `Secure`。                                                                                                                                                                    |
| `NEXTWIKI_DB_POOL_SIZE` | `10`                                                   | 每个应用进程的 PostgreSQL 最大连接数。应设置正整数，并确保“实例数 × 池大小”低于提供商限制。                                                                                                                                                                            |
| `NEXTWIKI_LOG_LEVEL`    | `info`                                                 | 使用项目日志记录器的代码所采用的 Pino 日志级别，例如 `debug`、`info`、`warn` 或 `error`。                                                                                                                                                                              |

生成密钥：

```bash
openssl rand -base64 32
```

生成值长度超过当前 32 字符的最低要求。生产环境不要使用示例开发密钥。

#### 容器密钥解析

原始镜像的启动脚本按以下顺序解析应用密钥：

1. 校验并使用非空的显式 `NEXTWIKI_SECRET` 环境变量值，然后删除任何旧回退文件。
2. 否则，读取非空的 `${NEXTWIKI_SECRET_DIR:-/app/secrets}/nextwiki-secret` 文件。
3. 否则，生成 32 字节随机值，以受限权限将其十六进制表示写入该文件，并导出给应用。

显式环境变量值会在删除任何回退前完成校验，且绝不会写入该文件。有效显式值生效时删除旧回退，可以防止该过期密钥日后悄然重新启用。若随后移除显式值，启动流程会生成新回退，并使现有会话、邮箱验证令牌、密码重置令牌、限流哈希和 IP 哈希失效。入口会拒绝符号链接密钥目录以及非普通、空或由其他用户拥有的回退文件，并把可复用文件的权限修正为 `0600`。原始 Compose 文件将 `nextwiki-secrets` 挂载到 `/app/secrets`，因此只要持续使用回退模式，生成值就会在重新创建容器和执行 `docker compose down` 后保留；`docker compose down -v` 会删除该卷。

`pnpm backup` 不包含 `nextwiki-secrets`。自动生成便于本地评估，但生产部署应从密钥管理器注入 `NEXTWIKI_SECRET`，并在缺少托管配置时让部署失败。若平台有意使用密钥文件，则必须在仓库脚本之外管理该文件的访问、备份、恢复以及跨实例一致性。

### 设置模式与网络隔离

公共 `/setup` 路由根据 PostgreSQL 得出以下三种模式之一：

| 模式       | 数据库状态               | 行为                                                              |
| ---------- | ------------------------ | ----------------------------------------------------------------- |
| `initial`  | 不存在站点               | 显示完整的站点配置与首位 Owner 工作流。                           |
| `owner`    | 已存在站点且用户总数为零 | 仅显示首位 Owner 引导；保留现有站点、设置、页面、修订和媒体引用。 |
| `complete` | 至少存在一个用户         | 设置已关闭，访问 `/setup` 会被重定向。                            |

在可信管理员完成设置前，应将应用或 `/setup` 与不可信网络隔离。恢复或预加载包含站点但没有用户的数据库后，这一点尤其重要：公开注册会保持阻断，但 `owner` 模式开放期间，任何能够访问 `/setup` 的访客仍能取得首位 Owner 账户。

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

| 变量                        | 默认值或必填值               | 说明                                                                                                                                                                                |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_BACKUP_DIR`       | `backups`                    | `pnpm backup` 使用的输出目录；新目录权限为 `0700`，生成文件权限为 `0600`。已存在的自定义目录应保护为 `0700` 或更严格。使用本地媒体时，其真实路径必须位于 `NEXTWIKI_MEDIA_ROOT` 外。 |
| `NEXTWIKI_COMPOSE_FALLBACK` | 未设置；只有 `1` 会显式启用  | 仅当主机 `pg_dump` 或 `psql` 不可用时，才允许锚定的 `compose:default/noviqwiki/db/nextwiki` 目标。它不会处理凭据、连接、SQL 及其他非零失败，并会忽略 `DATABASE_URL`。               |
| `NEXTWIKI_RESTORE_SQL`      | 恢复时必填                   | `pnpm restore` 读取的可读、非空 NoviqWiki 纯文本 `pg_dump`。                                                                                                                        |
| `NEXTWIKI_RESTORE_MEDIA`    | 可选                         | 本地媒体 `.tar.gz` 归档；脚本会预检安全成员路径且只接受普通文件和目录，并仅在使用本地驱动时解压。                                                                                   |
| `NEXTWIKI_RESTORE_CONFIRM`  | 恢复时必须提供与目标绑定的值 | `DATABASE_URL` 目标必须匹配 `restore:<host>:<port>/<database>`（省略端口时使用 `5432`）；显式启用的 Compose 目标必须严格匹配 `restore:compose:default/noviqwiki/db/nextwiki`。      |

执行任一命令前请阅读 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)。

备份与恢复脚本通过 `dotenv/config` 加载 `.env`，但各自只读取本操作所需的数据库、媒体以及备份或恢复变量。它们不会运行 Web 应用的完整环境校验，也不要求 `NEXTWIKI_SECRET`；但会严格解析最终的 PostgreSQL 目标、移除环境中的 libpq 路由覆盖，并防止 URL 密码出现在子进程参数中。固定 Compose 回退会清除项目、文件、主机和 context 覆盖，并锚定仓库文件、Docker `default` context 与 `noviqwiki` 项目。使用本地媒体时，备份要求 `NEXTWIKI_MEDIA_ROOT` 已经是专用的安全目录，而不会创建缺失的来源，且解析后的输出目录不能位于该媒体树内。媒体归档失败时会删除本次唯一命名备份的两个产物。恢复会先验证完整的 NoviqWiki 纯 SQL、安全的 tar 成员与类型以及所选数据库目标，再接受与目标绑定的确认值；随后会验证可写媒体目的地和 SQL 文件身份，并通过一个快速失败事务完成 Schema 重置与导入。数据库与媒体恢复仍是跨资源、非原子的。`pnpm backup` 既不复制 S3 对象，也不复制容器的 `nextwiki-secrets` 卷。应通过独立的提供商或平台流程保护这些资产。

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

不要将仓库默认的 Compose PostgreSQL 密码、公开的数据库端口、HTTP 基础 URL 或持久化在 `nextwiki-secrets` 卷中的自动生成 `NEXTWIKI_SECRET` 视为生产安全基线。由卷支持的生成密钥仅便于评估。应创建要求托管密钥的部署专用 Compose 覆盖文件或平台配置。

### 密钥轮换

应通过有计划的维护流程轮换 `NEXTWIKI_SECRET`、SMTP 凭据和 S3 凭据。轮换 `NEXTWIKI_SECRET` 会使现有会话以及尚未使用的邮箱验证和密码重置令牌失效，因为它们都由该密钥进行 HMAC 保护；限流和 IP 哈希也会改变。恢复流量前，应在所有应用实例上协调一致的新值。

生产日志和支持包不得包含密码、会话或 CSRF 令牌、重置或验证链接、访问密钥、原始 Cookie、含凭据的完整数据库 URL 或上传文件内容。
