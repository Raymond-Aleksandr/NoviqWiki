# NoviqWiki Deployment

> [English](DEPLOYMENT.md) | [简体中文](DEPLOYMENT.md#简体中文)

This guide describes the current NoviqWiki `0.1.0` deployment model: a Next.js standalone server, PostgreSQL, Drizzle migrations, persistent media storage, and optional Docker Compose packaging.

## Production Requirements

- A Linux container platform or a Node.js 22 runtime, matching `package.json` and the current Docker image.
- PostgreSQL 17 for the tested baseline. PostgreSQL must be reachable from the application and migration job.
- Persistent storage for local uploads, or a validated S3-compatible private bucket.
- HTTPS termination through a reverse proxy, load balancer, or platform ingress.
- Deployment-managed secrets and environment variables.
- Database and media backup, monitoring, alerting, and a tested restore procedure.
- A single public origin matching the base URL stored in the NoviqWiki site settings.

The repository's `compose.yaml` is a local/evaluation baseline, not a hardened production definition. As committed, it publishes PostgreSQL on host port `5432`, uses the example database password `nextwiki`, serves HTTP on port `3000`, hard-codes local media, and mounts `nextwiki-secrets` so the image can persist an automatically generated secret when no explicit value is supplied. Create a deployment-specific override or platform definition before internet-facing use.

## Verify a Release Candidate

Install the locked dependencies and run the repository quality gates from the exact release candidate:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config --quiet
docker compose build
```

`--quiet` validates Compose without printing the resolved configuration. Plain `docker compose config` can expose resolved secrets and must not be captured in logs or review artifacts.

`pnpm test:ui` is a separate live-server audit. When it is part of the release decision, run it with the prerequisites and authenticated coverage described in [TESTING.md](./TESTING.md#ui-release-audit). Do not insert an unprepared bare `pnpm test:ui` into a batch command because it expects an already running server.

Record results only after running them in the current checkout. Pin the deployed source commit or container digest so the artifact can be correlated with those results.

## Production Environment

At minimum, a local-media production deployment needs explicit values equivalent to:

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=/app/media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

For S3-compatible media, replace the local-media values and provide the complete current S3 set:

```bash
NEXTWIKI_MEDIA_DRIVER=s3
NEXTWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NEXTWIKI_S3_REGION=us-east-1
NEXTWIKI_S3_BUCKET=noviqwiki-assets
NEXTWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NEXTWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

The current S3 adapter requires the endpoint, bucket, access key, and secret key and uses path-style requests. Validate the chosen provider and browser delivery path before rollout. Configure both SMTP variables when email verification or password-reset delivery is required.

The setup wizard writes a base URL into PostgreSQL. After setup, changing only `NEXTWIKI_BASE_URL` does not update that stored value; update `/admin/settings` as well. The stored URL is authoritative for generated application and recovery links, but it does not control cookie security. Session and CSRF cookies receive `Secure` only when the environment `NEXTWIKI_BASE_URL` has the `https:` scheme, regardless of `NODE_ENV`. See [CONFIGURATION.md](./CONFIGURATION.md) for environment-loading rules and the full variable reference.

## Setup Modes and Exposure

The `/setup` route has three database-derived modes:

| Mode       | Database state                                 | Result                                                                                                                 |
| ---------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `initial`  | No site exists                                 | Full site configuration and first-Owner setup are available.                                                           |
| `owner`    | A site exists and the total user count is zero | Only first-Owner bootstrap is available; existing site settings, pages, revisions, and media references are preserved. |
| `complete` | At least one user exists                       | Setup is closed and `/setup` redirects away.                                                                           |

Keep the application or `/setup` isolated from untrusted networks until a trusted administrator completes setup. In particular, a restored or preloaded database with a site but zero users enters `owner` mode. Public registration remains blocked, but any visitor who can reach `/setup` during that window can claim the first Owner account.

## Database Migrations

The migration command is:

```bash
pnpm db:migrate
```

It uses a PostgreSQL advisory lock, so concurrent invocations serialize. For every release:

1. Back up PostgreSQL and media first.
2. Review the target release's SQL in `drizzle/`.
3. Test it against a representative staging copy.
4. Export the exact production `DATABASE_URL`; operational scripts load `.env` by default, not `.env.local`.
5. Run the migration once as a controlled release step and retain its output.
6. Keep the previous application image and the pre-migration backup until post-deploy validation passes.

The current Docker image also runs `scripts/migrate.ts` automatically in its `CMD` before starting the standalone server. This means every container start attempts the idempotent migration path under the advisory lock. A platform that uses a dedicated migration job should customize the startup process so migration ownership is unambiguous; do not describe the stock image as migration-free.

Do not start old application code against a schema known to be incompatible with it.

## Docker Compose Evaluation

For local evaluation, validate, build, and start:

```bash
docker compose config --quiet
docker compose build
docker compose up -d
```

Always use `--quiet` for human validation. Plain `docker compose config` renders resolved environment values and its output must not be copied into logs or review artifacts.

The stock image's startup script resolves the secret as follows:

1. When a non-empty explicit `NEXTWIKI_SECRET` environment value exists, use it and proactively delete `${NEXTWIKI_SECRET_DIR:-/app/secrets}/nextwiki-secret` if that fallback file exists.
2. Otherwise, read a non-empty fallback file at that path.
3. If no non-empty fallback exists, generate a 32-byte random value, write its hexadecimal representation to that file with restrictive permissions, and export it to the application.

An explicit `NEXTWIKI_SECRET` is never written to the fallback file. The stock Compose file mounts `nextwiki-secrets` at `/app/secrets`, so a fallback survives container replacement and `docker compose down` while no explicit value is used. Starting with an explicit value removes that persisted fallback. If the explicit value is later removed, no old fallback remains to recover: startup generates a new one, invalidating existing HMAC-derived sessions, email-verification tokens, password-reset tokens, rate-limit hashes, and IP hashes. Operators may inject the explicit value through the shell, an untracked `.env`, or an override. Production must use one stable, explicitly managed value rather than switch between an explicit secret and automatic fallback generation.

Inspect status and logs:

```bash
docker compose ps
docker compose logs --tail=200 app
```

The committed service names are `app` and `db`. The named volumes are `nextwiki-db`, `nextwiki-media`, `nextwiki-backups`, and `nextwiki-secrets` under the Compose project name. `docker compose down` preserves them. `docker compose down -v` deletes the database, local media, backup output, and persisted fallback secret; it must not be used on retained data without an explicit destructive-operation plan. If no explicit managed secret is supplied after deleting the secret volume, startup generates a new value and invalidates existing HMAC-derived sessions and tokens, as does removing an explicit value after it has deleted the old fallback.

`pnpm backup` does not include `nextwiki-secrets`. A production deployment should keep `NEXTWIKI_SECRET` in its secret manager. A platform that deliberately uses the file fallback must protect and recover that file separately and keep it consistent across instances.

## Hardening Compose for Production

A production-specific Compose or platform definition should, at minimum:

- Replace the example PostgreSQL credentials, or use a managed database.
- Stop publishing PostgreSQL to the public host unless an explicitly secured administration path requires it.
- Inject `DATABASE_URL`, `NEXTWIKI_BASE_URL`, `NEXTWIKI_SECRET`, media, SMTP, pool, and log settings from the deployment environment or secret manager.
- Fail deployment when the managed `NEXTWIKI_SECRET` is missing instead of relying on the image's evaluation-friendly automatic generation and secret volume.
- Mount local media and backup output on independently backed-up persistent storage, or configure the complete S3 backend.
- Pin the application image to a release tag and preferably an immutable digest.
- Add resource limits, log retention, update policy, and platform-specific health checks.
- Keep database and application networks private, exposing only the reverse proxy or ingress.

Do not assume that values in `.env.local` reach Compose; Compose reads shell variables and `.env` unless `--env-file` is specified.

## Reverse Proxy and HTTPS

Terminate TLS before traffic reaches the Next.js server and forward or overwrite these headers:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

The proxy must remove untrusted client-supplied forwarding headers and write its own values. NoviqWiki uses forwarded host/protocol information for same-origin redirects and uses the forwarded client address in security metadata. Incorrect trust boundaries can produce bad redirects or spoofed IP attribution.

Set `NODE_ENV=production`, serve only through HTTPS, and set both the environment and stored site base URLs to the external HTTPS origin. The environment `NEXTWIKI_BASE_URL` alone controls the `Secure` attribute on session and CSRF cookies: its scheme must be `https:`. Neither `NODE_ENV` nor the base URL stored in PostgreSQL changes that cookie decision. The stored URL remains authoritative for generated application and recovery links.

Apply request-size, timeout, and rate controls at the proxy in addition to application validation. Preserve Web and API response headers such as CSP, `X-Content-Type-Options`, and `X-Frame-Options`.

## Health Checks

The endpoints are always present in the current application:

```text
GET /api/health
GET /api/ready
```

- `/api/health` is a process liveness response and does not query PostgreSQL.
- `/api/ready` queries PostgreSQL and calls the active storage adapter's readiness check.
- Local-storage readiness creates/checks the configured directory. The current S3 readiness check confirms only that a bucket name is configured; it does not make a remote S3 request. Use a separate provider probe or a real upload/read smoke test when S3 availability matters.

Manual checks:

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

Route load-balancer liveness and readiness according to platform behavior. Do not use only `GET /` as readiness evidence because it may redirect to setup or authentication and does not independently prove media availability.

## Static Assets and Media

Next.js static assets are included in the standalone image. Local user media must live on the persistent path configured by `NEXTWIKI_MEDIA_ROOT`; the committed Compose file mounts `/app/media`.

The current authorized local-media route sends `Cache-Control: public, max-age=31536000, immutable`. Private wikis must configure the reverse proxy/CDN to prevent shared caching. Deployments that require immediate revocation after logout, permission removal, a private-mode change, or deletion must change the application route to `Cache-Control: private, no-store` and purge already cached objects or rotate previously distributed URLs.

For S3-compatible storage:

- Use a private, versioned, encrypted bucket.
- Scope credentials to the required object operations and bucket prefix.
- Confirm the endpoint works with path-style requests and one-hour signed GET URLs.
- Verify representative images and files in a real browser under the deployed CSP, not only through a direct bucket request.
- Back up the bucket independently; `pnpm backup` does not copy S3 objects.

Changing storage drivers does not migrate existing objects. Plan and verify an explicit object migration before changing `NEXTWIKI_MEDIA_DRIVER`.

`pnpm backup` always creates a PostgreSQL dump and creates a media `.tar.gz` archive only for the `local` driver. It does not include S3 objects or `nextwiki-secrets`. The backup and restore scripts load `.env`, but each reads only its relevant database, media, and backup or restore variables; they do not run full web-application configuration validation and do not require `NEXTWIKI_SECRET`.

## Observability

Collect container stdout/stderr, reverse-proxy access logs, PostgreSQL metrics, and provider metrics. The application has a Pino logger configuration and database-backed audit-event support, but the logger is not wired into every framework/lifecycle path and audit coverage is not complete for every privileged workflow. The platform should provide start, stop, crash, resource, and health-transition visibility.

Alert on at least:

- Repeated readiness failures or restarts.
- Migration errors.
- Authentication-failure spikes and rate limiting.
- Privileged administration activity.
- Media upload/read failures.
- Unhandled server responses and elevated latency.
- Database connection/pool exhaustion and backup failures.

Logs, traces, metrics labels, and support bundles must not contain passwords, raw cookies, session or CSRF tokens, reset links, access keys, full credential-bearing URLs, or uploaded content bodies.

## Post-Deployment Validation

After health checks pass, validate with appropriate test accounts:

1. Setup mode is correct: no site opens full setup, a site with zero total users opens only first-Owner bootstrap, and any existing user closes setup.
2. Login and logout work over HTTPS.
3. Public and restricted-page access matches policy.
4. A page edit creates a new immutable revision; history, diff, and search update.
5. Existing media loads and a new upload works when enabled.
6. Admin pages reject users without the required permission.
7. Email delivery and recovery-link origins are correct when SMTP is enabled.
8. Backup monitoring and the next scheduled backup cover PostgreSQL and the active media backend; managed-secret recovery is handled separately.

## Rollback

Rollback requires coordinated application, schema, and media planning:

1. Stop or drain writes.
2. Determine whether the applied migrations are backward compatible with the previous image.
3. If no incompatible migration ran, redeploy the pinned previous image and validate it.
4. If a destructive or incompatible migration ran, restore the pre-deploy PostgreSQL backup and matching media state before starting the old image.
5. Reapply the previous environment and stored base-URL expectations.
6. Run health, login, page read/edit/history/search, authorization, and media smoke checks before restoring traffic.

The repository currently has forward Drizzle migrations and no general automatic down-migration command. Never roll back application code across a non-reversible schema change without a verified restore plan. See [UPGRADING.md](./UPGRADING.md) and [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).

---

## 简体中文

> [English](DEPLOYMENT.md) | [简体中文](DEPLOYMENT.md#简体中文)

本文说明 NoviqWiki `0.1.0` 当前的部署模型：Next.js 独立服务器、PostgreSQL、Drizzle 迁移、持久化媒体存储，以及可选的 Docker Compose 打包方式。

### 生产环境要求

- 与 `package.json` 和当前 Docker 镜像匹配的 Linux 容器平台或 Node.js 22 运行时。
- 经当前流程验证的 PostgreSQL 17。应用和迁移任务都必须能够访问 PostgreSQL。
- 本地上传所需的持久化存储，或经过验证的兼容 S3 私有存储桶。
- 通过反向代理、负载均衡器或平台入口终止 HTTPS。
- 由部署系统管理的密钥和环境变量。
- 数据库与媒体备份、监控、告警以及经过测试的恢复流程。
- 与 NoviqWiki 站点设置中基础 URL 一致的单一公共源。

仓库中的 `compose.yaml` 是本地或评估基线，不是经过强化的生产定义。当前文件将 PostgreSQL 发布到主机 `5432` 端口，使用示例数据库密码 `nextwiki`，通过 `3000` 端口提供 HTTP，固定使用本地媒体，并挂载 `nextwiki-secrets`，以便镜像在未提供显式值时持久化自动生成的密钥。面向互联网部署前，必须创建部署专用覆盖文件或平台定义。

### 验证候选版本

在准确的候选版本上安装锁定依赖并运行仓库质量门禁：

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config --quiet
docker compose build
```

`--quiet` 会验证 Compose，但不打印解析后的配置。普通的 `docker compose config` 可能暴露解析后的密钥，不得将其输出写入日志或审查材料。

`pnpm test:ui` 是独立的在线服务器审计。如果它属于发布决策，请按照 [TESTING.md](./TESTING.md#ui-发布审计) 中的前置条件和已登录覆盖方式运行。不要把未经准备的裸 `pnpm test:ui` 塞入批处理命令，因为它要求服务器已经运行。

只有在当前检出上实际执行后才能记录结果。固定部署的源代码提交或容器摘要，以便将制品与验证结果关联。

### 生产环境变量

使用本地媒体的生产部署至少需要以下等效显式值：

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret-of-at-least-32-characters
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=/app/media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

使用兼容 S3 的媒体时，请替换本地媒体值，并提供当前所需的完整 S3 变量：

```bash
NEXTWIKI_MEDIA_DRIVER=s3
NEXTWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NEXTWIKI_S3_REGION=us-east-1
NEXTWIKI_S3_BUCKET=noviqwiki-assets
NEXTWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NEXTWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

当前 S3 适配器要求端点、存储桶、访问密钥和密钥，并使用路径样式请求。上线前应验证所选提供商和浏览器交付路径。需要邮箱验证或密码重置邮件时，应同时配置两个 SMTP 变量。

设置向导会把基础 URL 写入 PostgreSQL。完成设置后，仅修改 `NEXTWIKI_BASE_URL` 不会更新该存储值；还必须在 `/admin/settings` 中更新。存储的 URL 是生成应用与恢复链接的权威值，但不控制 Cookie 安全性。只有环境变量 `NEXTWIKI_BASE_URL` 使用 `https:` 协议时，会话与 CSRF Cookie 才带有 `Secure`，与 `NODE_ENV` 无关。环境加载规则和完整变量说明见 [CONFIGURATION.md](./CONFIGURATION.md)。

### 设置模式与暴露范围

`/setup` 路由具有以下三种由数据库得出的模式：

| 模式       | 数据库状态               | 结果                                                              |
| ---------- | ------------------------ | ----------------------------------------------------------------- |
| `initial`  | 不存在站点               | 可进行完整站点配置和首位 Owner 设置。                             |
| `owner`    | 已存在站点且用户总数为零 | 仅可进行首位 Owner 引导；保留现有站点设置、页面、修订和媒体引用。 |
| `complete` | 至少存在一个用户         | 设置已关闭，访问 `/setup` 会被重定向。                            |

在可信管理员完成设置前，应将应用或 `/setup` 与不可信网络隔离。尤其是，已恢复或预加载且包含站点但没有用户的数据库会进入 `owner` 模式；公开注册会保持阻断，但在此期间，任何能够访问 `/setup` 的访客仍能取得首位 Owner 账户。

### 数据库迁移

迁移命令为：

```bash
pnpm db:migrate
```

该命令使用 PostgreSQL advisory lock，因此并发调用会串行执行。每次发布应：

1. 先备份 PostgreSQL 和媒体。
2. 检查目标版本 `drizzle/` 中的 SQL。
3. 在具有代表性的预发布数据副本上测试。
4. 导出准确的生产 `DATABASE_URL`；运维脚本默认加载 `.env`，不是 `.env.local`。
5. 将迁移作为受控发布步骤运行一次并保留输出。
6. 在部署后验证通过前，保留旧应用镜像和迁移前备份。

当前 Docker 镜像还会在 `CMD` 中、启动独立服务器前自动执行 `scripts/migrate.ts`。这意味着每次容器启动都会在 advisory lock 保护下尝试幂等迁移。使用专用迁移任务的平台应自定义启动流程，使迁移责任清晰；不要把原始镜像描述成“不执行迁移”。

不要让旧应用代码连接到已知不兼容的架构。

### Docker Compose 评估

本地评估时，执行验证、构建并启动：

```bash
docker compose config --quiet
docker compose build
docker compose up -d
```

人工验证始终应使用 `--quiet`。普通的 `docker compose config` 会渲染解析后的环境变量值，其输出不得复制到日志或审查材料中。

原始镜像的启动脚本按以下方式解析密钥：

1. 若存在非空的显式 `NEXTWIKI_SECRET` 环境变量值，则使用该值，并主动删除 `${NEXTWIKI_SECRET_DIR:-/app/secrets}/nextwiki-secret` 回退文件（若存在）。
2. 否则，读取该路径下的非空回退文件。
3. 若不存在非空回退文件，则生成 32 字节随机值，以受限权限将其十六进制表示写入该文件，并导出给应用。

显式 `NEXTWIKI_SECRET` 绝不会写入回退文件。原始 Compose 文件将 `nextwiki-secrets` 挂载到 `/app/secrets`，因此在未使用显式值期间，回退密钥会在替换容器和执行 `docker compose down` 后保留。使用显式值启动会删除该持久化回退；日后若移除显式值，就没有旧回退可供恢复，启动流程会生成新值，并使现有 HMAC 派生的会话、邮箱验证令牌、密码重置令牌、限流哈希和 IP 哈希失效。运维人员可通过 shell、未跟踪的 `.env` 或覆盖文件注入显式值。生产环境必须使用单一、稳定且由部署系统明确管理的值，不应在显式密钥和自动回退之间切换。

检查状态和日志：

```bash
docker compose ps
docker compose logs --tail=200 app
```

提交的服务名为 `app` 和 `db`。Compose 项目名下的命名卷分别为 `nextwiki-db`、`nextwiki-media`、`nextwiki-backups` 和 `nextwiki-secrets`。`docker compose down` 会保留它们。`docker compose down -v` 会删除数据库、本地媒体、备份输出和持久化回退密钥；在没有明确破坏性操作方案时，不得对保留数据使用。删除密钥卷后若未提供显式托管密钥，启动时会生成新值并使现有 HMAC 派生的会话和令牌失效；显式值删除旧回退后再被移除，也会产生相同结果。

`pnpm backup` 不包含 `nextwiki-secrets`。生产部署应将 `NEXTWIKI_SECRET` 保存在密钥管理器中。若平台有意使用文件回退，则必须单独保护和恢复该文件，并保持跨实例一致。

### 强化生产 Compose

生产专用 Compose 或平台定义至少应：

- 替换示例 PostgreSQL 凭据，或使用托管数据库。
- 除非明确需要且已加固管理路径，否则不要把 PostgreSQL 发布到公共主机。
- 从部署环境或密钥管理器注入 `DATABASE_URL`、`NEXTWIKI_BASE_URL`、`NEXTWIKI_SECRET`、媒体、SMTP、连接池和日志设置。
- 在缺少托管的 `NEXTWIKI_SECRET` 时让部署失败，而不是依赖镜像为评估提供的自动生成机制和密钥卷。
- 将本地媒体和备份输出挂载到独立备份的持久存储，或配置完整 S3 后端。
- 将应用镜像固定到发布标签，最好再固定不可变摘要。
- 增加资源限制、日志保留、更新策略和平台健康检查。
- 保持数据库与应用网络私有，仅暴露反向代理或入口。

不要假设 `.env.local` 中的值会进入 Compose；除非指定 `--env-file`，Compose 读取 shell 变量和 `.env`。

### 反向代理与 HTTPS

在流量到达 Next.js 服务器前终止 TLS，并转发或覆盖以下请求头：

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

代理必须删除客户端提供的不可信转发头，并写入自己的值。NoviqWiki 使用转发的主机和协议生成同源重定向，并在安全元数据中使用转发的客户端地址。信任边界配置错误会造成错误重定向或伪造 IP 归因。

设置 `NODE_ENV=production`，只通过 HTTPS 提供服务，并将环境变量和站点存储的基础 URL 都设为外部 HTTPS 源。只有环境变量 `NEXTWIKI_BASE_URL` 决定会话与 CSRF Cookie 是否带有 `Secure`：其协议必须为 `https:`。`NODE_ENV` 和 PostgreSQL 中存储的基础 URL 都不会改变这项 Cookie 决策。存储的 URL 仍是生成应用与恢复链接的权威值。

除应用校验外，还应在代理层设置请求大小、超时和限流。保留 CSP、`X-Content-Type-Options` 和 `X-Frame-Options` 等 Web 与 API 响应头。

### 健康检查

当前应用始终提供以下端点：

```text
GET /api/health
GET /api/ready
```

- `/api/health` 是进程存活响应，不查询 PostgreSQL。
- `/api/ready` 查询 PostgreSQL，并调用当前存储适配器的就绪检查。
- 本地存储就绪检查会创建或检查配置目录。当前 S3 就绪检查只确认已配置存储桶名称，不会发起远程 S3 请求。S3 可用性很重要时，应另设提供商探针或执行真实上传与读取冒烟测试。

手动检查：

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

根据平台行为分别配置负载均衡器的存活与就绪探针。不要只用 `GET /` 作为就绪证据，因为它可能重定向到设置或登录页，也不能独立证明媒体可用。

### 静态资源与媒体

Next.js 静态资源已包含在独立镜像中。本地用户媒体必须位于 `NEXTWIKI_MEDIA_ROOT` 指定的持久路径；提交的 Compose 文件将其挂载到 `/app/media`。

当前已授权的本地媒体路由发送 `Cache-Control: public, max-age=31536000, immutable`。私有 Wiki 必须配置反向代理/CDN 禁止共享缓存。若部署要求在退出登录、移除权限、切换私有模式或删除后立即撤销访问，则必须把应用路由改为 `Cache-Control: private, no-store`，并清除已缓存对象或轮换此前分发的 URL。

对于兼容 S3 的存储：

- 使用私有、已启用版本控制且加密的存储桶。
- 将凭据权限限制到所需对象操作和存储桶前缀。
- 确认端点兼容路径样式请求和一小时签名 GET URL。
- 在部署 CSP 下用真实浏览器验证代表性图片和文件，而不仅是直接请求存储桶。
- 独立备份存储桶；`pnpm backup` 不复制 S3 对象。

更改存储驱动不会迁移现有对象。修改 `NEXTWIKI_MEDIA_DRIVER` 前必须规划并验证明确的对象迁移。

`pnpm backup` 始终创建 PostgreSQL 转储，并且仅对 `local` 驱动创建媒体 `.tar.gz` 归档。它不包含 S3 对象或 `nextwiki-secrets`。备份与恢复脚本会加载 `.env`，但各自只读取本操作所需的数据库、媒体以及备份或恢复变量；它们不会运行 Web 应用的完整配置校验，也不要求 `NEXTWIKI_SECRET`。

### 可观测性

收集容器标准输出和错误、反向代理访问日志、PostgreSQL 指标以及提供商指标。应用包含 Pino 日志配置和数据库审计事件支持，但日志记录器尚未接入所有框架/生命周期路径，审计也未覆盖所有特权工作流。平台必须提供启动、停止、崩溃、资源和健康状态变化的可见性。

至少应对以下情况告警：

- 重复就绪失败或重启。
- 迁移错误。
- 身份验证失败激增和限流。
- 特权管理活动。
- 媒体上传或读取失败。
- 未处理服务器响应和延迟升高。
- 数据库连接或连接池耗尽以及备份失败。

日志、跟踪、指标标签和支持包不得包含密码、原始 Cookie、会话或 CSRF 令牌、重置链接、访问密钥、含凭据的完整 URL 或上传内容正文。

### 部署后验证

健康检查通过后，使用适当测试账户验证：

1. 设置模式正确：没有站点时开放完整设置；站点用户总数为零时仅开放首位 Owner 引导；存在任何用户后关闭设置。
2. 通过 HTTPS 登录和退出正常。
3. 公共和受限页面访问符合策略。
4. 编辑页面会创建新的不可变修订；历史、差异和搜索同步更新。
5. 现有媒体可加载；启用上传时新上传成功。
6. 没有所需权限的用户被管理页面拒绝。
7. 启用 SMTP 时，邮件投递和恢复链接来源正确。
8. 备份监控和下一次计划备份覆盖 PostgreSQL 与当前媒体后端；托管密钥的恢复由独立流程处理。

### 回滚

回滚需要协调应用、架构和媒体：

1. 停止或排空写入。
2. 判断已应用迁移是否与旧镜像向后兼容。
3. 若未执行不兼容迁移，重新部署固定的旧镜像并验证。
4. 若执行了破坏性或不兼容迁移，在启动旧镜像前恢复部署前 PostgreSQL 备份和匹配的媒体状态。
5. 恢复旧环境变量以及站点基础 URL 的预期值。
6. 恢复流量前执行健康、登录、页面读取与编辑、历史、搜索、授权和媒体冒烟检查。

仓库当前只有向前的 Drizzle 迁移，没有通用自动向下迁移命令。没有经过验证的恢复方案时，绝不能让应用代码跨越不可逆架构变更回滚。另见 [UPGRADING.md](./UPGRADING.md) 和 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)。
