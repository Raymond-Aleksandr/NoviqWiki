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
- A single public origin matching the deployment-managed `NOVIQWIKI_BASE_URL`.

The repository's `compose.yaml` is a secure local baseline: it requires explicit database and application secrets, keeps PostgreSQL private, and binds HTTP to `127.0.0.1:3000`. An internet-facing deployment still needs HTTPS termination, managed secrets, backups, observability, resource limits, and a deployment-specific image policy.

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

CI provisions PostgreSQL 17 for integration tests and runs the real PostgreSQL migration and concurrency coverage. Supply the documented disposable test database URL when reproducing that subset locally.

Record results only after running them in the current checkout. Pin the deployed source commit or container digest so the artifact can be correlated with those results.

## Production Environment

At minimum, a local-media production deployment needs explicit values equivalent to:

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

For S3-compatible media, replace the local-media values and provide the complete current S3 set:

```bash
NOVIQWIKI_MEDIA_DRIVER=s3
NOVIQWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NOVIQWIKI_S3_REGION=us-east-1
NOVIQWIKI_S3_BUCKET=noviqwiki-assets
NOVIQWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NOVIQWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

The current S3 adapter requires the endpoint, bucket, access key, and secret key and uses path-style requests. Validate the chosen provider and browser delivery path before rollout. Configure both SMTP variables when email verification or password-reset delivery is required.

In production, `NOVIQWIKI_BASE_URL` is authoritative for request validation, redirects, citations, and email links even if PostgreSQL contains an older setup value. Use HTTPS in production. Enter `NOVIQWIKI_SETUP_TOKEN` during initial Owner setup, then remove it from the deployment environment and restart. See [CONFIGURATION.md](./CONFIGURATION.md) for environment-loading rules and the full variable reference.

## Setup Modes and Exposure

The `/setup` route has three database-derived modes:

| Mode       | Database state                        | Result                                                                                                                           |
| ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `initial`  | No site exists                        | Full site configuration and first-Owner setup are available.                                                                     |
| `owner`    | A site exists but has no active Owner | Only Owner recovery/bootstrap is available; existing site settings, pages, revisions, users, and media references are preserved. |
| `complete` | The site has an active Owner          | Setup is closed and `/setup` redirects away.                                                                                     |

Keep the application or `/setup` isolated from untrusted networks until a trusted administrator completes setup. In particular, a restored or preloaded database whose site has no active Owner enters `owner` mode. Public registration remains blocked, but any visitor who can reach `/setup` during that window can recover the Owner role.

For the supplied Compose file, also set a unique raw `POSTGRES_PASSWORD` and set the required
`DATABASE_URL` to a complete URL whose host is `db`. Compose does not interpolate the password into
the URL. Percent-encode any reserved characters in the URL credentials while keeping
`POSTGRES_PASSWORD` raw. PostgreSQL is reachable only on the private Compose network; do not
publish its port in an internet-facing deployment.

## Database Migrations

The migration command is:

```bash
pnpm db:migrate
```

The host command is for environments where `DATABASE_URL` is reachable from the host. The supplied Compose database is private; run the release migration through the app image instead:

```bash
docker compose up -d db
docker compose run --rm --no-deps app node scripts/migrate.mjs
```

The supplied image also runs this migration runner before starting the server. It uses a PostgreSQL advisory lock, so concurrent container starts serialize migration work and already-applied releases are a no-op. For every release:

1. Back up PostgreSQL and media first.
2. Review the target release's SQL in `drizzle/`.
3. Test it against a representative staging copy.
4. Export the exact production `DATABASE_URL`; operational scripts load `.env` by default, not `.env.local`.
5. Run the migration once as a controlled release step and retain its output.
6. Keep the previous application image and the pre-migration backup until post-deploy validation passes.

A platform that uses a dedicated migration job should customize the startup process so migration ownership is unambiguous; do not describe the stock image as migration-free.

Do not start old application code against a schema known to be incompatible with it.

## Docker Compose Evaluation

For local evaluation, validate, build, and start:

```bash
docker compose config --quiet
docker compose build
docker compose up -d
```

Always use `--quiet` for human validation. Plain `docker compose config` renders resolved environment values and its output must not be copied into logs or review artifacts.

Keep `NOVIQWIKI_SECRET` stable across restarts and replicas. On a fresh installation, remove the
one-time `NOVIQWIKI_SETUP_TOKEN` after the first Owner has completed setup and restart the service.

Inspect runtime status:

```bash
docker compose ps
docker compose logs --tail=200 app
```

The committed service names are `app` and `db`. The named volumes are `noviqwiki-db`, `noviqwiki-media`, and `noviqwiki-backups` under the Compose project name. `docker compose down` preserves them. `docker compose down -v` deletes the database, local media, and backup output; it must not be used on retained data without an explicit destructive-operation plan. Keep `NOVIQWIKI_SECRET` in an approved secret manager.

## Hardening Compose for Production

A production-specific Compose or platform definition should, at minimum:

- Use unique PostgreSQL credentials, or use a managed database.
- Keep PostgreSQL private; host development should use only the loopback mapping in `compose.dev.yaml`.
- Inject `DATABASE_URL`, `NOVIQWIKI_BASE_URL`, `NOVIQWIKI_SECRET`, media, SMTP, pool, and log settings from the deployment environment or secret manager.
- Continue failing deployment when the managed `NOVIQWIKI_SECRET` is missing.
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

The proxy must remove untrusted client-supplied forwarding headers and write its own values. Set `NOVIQWIKI_BASE_URL` to the externally visible HTTPS URL. It is the production-authoritative origin for request validation, redirects, email links, and citations even if the database contains an older Base URL from setup. Production cookies must be secure.

The supplied Compose port binds to `127.0.0.1:3000` so a host reverse proxy can reach it without publishing the application directly. If the proxy is another Compose service, remove the host port mapping and route to `app:3000` over the private service network.

`X-Forwarded-For` is ignored for source-based authentication rate limits unless `NOVIQWIKI_TRUSTED_PROXY_HOPS` is configured. Set it only to the fixed number of trusted proxies between the client and NoviqWiki, and only when network policy prevents direct access to the application port and every trusted proxy overwrites or appends its immediate peer address. Invalid or incomplete IP chains do not enable a source bucket; account and global limits remain active.

Apply request-size, timeout, and rate controls at the proxy in addition to application validation. Preserve Web and API response headers such as CSP, `X-Content-Type-Options`, and `X-Frame-Options`.

## Health Checks

At minimum, verify the application can serve `GET /` and connect to the database after deployment. Use liveness for process monitoring and readiness for load-balancer routing. Readiness returns HTTP 503 when PostgreSQL or the configured media backend cannot be used:

```text
GET /api/health
GET /api/ready
```

- `/api/health` is a process liveness response and does not query PostgreSQL.
- `/api/ready` queries PostgreSQL and calls the active storage adapter's readiness check.
- Local and S3 readiness perform bounded write/read/delete probes. Local storage rejects unsafe or linked roots before probing; S3 uses `.noviqwiki-readiness/` and deletes the exact probe object/version.

Manual checks:

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

Route load-balancer liveness and readiness according to platform behavior. Do not use only `GET /` as readiness evidence because it may redirect to setup or authentication and does not independently prove media availability.

## Static Assets and Media

Next.js static assets are included in the standalone image. Local user media must live on the persistent path configured by `NOVIQWIKI_MEDIA_ROOT`; the committed Compose file mounts `/app/media`.

Local and S3 media are authorized and streamed through the same-origin `/media/{key}` route. Public-site responses use `Cache-Control: public, max-age=0, must-revalidate`; private-site responses use `Cache-Control: private, no-store`. Non-inline-safe types are served as attachments, and S3 signatures are never persisted or exposed.

For S3-compatible storage:

- Use a private, versioned, encrypted bucket.
- Grant object read, write, and delete permissions for media keys and the `.noviqwiki-readiness/` probe prefix.
- When versioning is enabled, allow deletion of the exact probe version so readiness checks do not accumulate versions or delete markers.
- Back up the bucket independently; `pnpm backup` does not copy S3 objects.

Changing storage drivers does not migrate existing objects. Plan and verify an explicit object migration before changing `NOVIQWIKI_MEDIA_DRIVER`.

`pnpm backup` always creates a PostgreSQL dump and creates a media `.tar.gz` archive only for the `local` driver. It does not include S3 objects or deployment secrets. Read [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) before operating it.

Successful S3 capability probes are cached for five minutes and failures for 30 seconds. Concurrent
readiness requests share one in-flight probe.

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

1. Setup mode is correct: no site opens full setup, a site with no active Owner opens only Owner recovery/bootstrap, and an active Owner closes setup.
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
- 与部署管理的 `NOVIQWIKI_BASE_URL` 一致的单一公共源。

仓库中的 `compose.yaml` 是安全的本地基线：它要求显式数据库与应用密钥，将 PostgreSQL 保持在私有网络，并只把 HTTP 应用绑定到 `127.0.0.1:3000`。面向互联网部署仍须配置 HTTPS、受管密钥、备份、可观测性、资源限制和部署专用镜像策略；主机开发仅可通过 `compose.dev.yaml` 的回环映射访问数据库。

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

CI 会为集成测试提供 PostgreSQL 17，并运行真实 PostgreSQL 迁移与并发覆盖；本地复现时应提供文档规定的测试数据库 URL。

只有在当前检出上实际执行后才能记录结果。固定部署的源代码提交或容器摘要，以便将制品与验证结果关联。

### 生产环境变量

使用本地媒体的生产部署至少需要以下等效显式值：

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

使用兼容 S3 的媒体时，请替换本地媒体值，并提供当前所需的完整 S3 变量：

```bash
NOVIQWIKI_MEDIA_DRIVER=s3
NOVIQWIKI_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
NOVIQWIKI_S3_REGION=us-east-1
NOVIQWIKI_S3_BUCKET=noviqwiki-assets
NOVIQWIKI_S3_ACCESS_KEY_ID=replace-with-access-key
NOVIQWIKI_S3_SECRET_ACCESS_KEY=replace-with-secret-key
```

当前 S3 适配器要求端点、存储桶、访问密钥和密钥，并使用路径样式请求。上线前应验证所选提供商和浏览器交付路径。需要邮箱验证或密码重置邮件时，应同时配置两个 SMTP 变量。

生产环境中，部署管理的 `NOVIQWIKI_BASE_URL` 是请求校验、重定向、引用和邮件链接的权威源，即使 PostgreSQL 中仍保存旧设置值。生产必须使用 HTTPS。初始 Owner 设置时输入 `NOVIQWIKI_SETUP_TOKEN`，完成后从环境中移除并重启。环境加载规则和完整变量说明见 [CONFIGURATION.md](./CONFIGURATION.md)。

### 设置模式与暴露范围

`/setup` 路由具有以下三种由数据库得出的模式：

| 模式       | 数据库状态                 | 结果                                                                     |
| ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `initial`  | 不存在站点                 | 可进行完整站点配置和首位 Owner 设置。                                    |
| `owner`    | 已存在站点但没有活跃 Owner | 仅可进行 Owner 恢复/引导；保留现有站点设置、页面、修订、用户和媒体引用。 |
| `complete` | 站点存在活跃 Owner         | 设置已关闭，访问 `/setup` 会被重定向。                                   |

在可信管理员完成设置前，应将应用或 `/setup` 与不可信网络隔离。尤其是，已恢复或预加载且没有活跃 Owner 的站点会进入 `owner` 模式；公开注册会保持阻断，但在此期间，任何能够访问 `/setup` 的访客仍能恢复 Owner 角色。

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

当前 Docker 镜像还会在 `CMD` 中、启动独立服务器前自动执行 `scripts/migrate.mjs`。这意味着每次容器启动都会在 advisory lock 保护下尝试幂等迁移。使用专用迁移任务的平台应自定义启动流程，使迁移责任清晰；不要把原始镜像描述成“不执行迁移”。

不要让旧应用代码连接到已知不兼容的架构。

### Docker Compose 评估

本地评估时，执行验证、构建并启动：

```bash
docker compose config --quiet
docker compose build
docker compose up -d
```

人工验证始终应使用 `--quiet`。普通的 `docker compose config` 会渲染解析后的环境变量值，其输出不得复制到日志或审查材料中。

Compose 在缺少或清空 `DATABASE_URL`、`POSTGRES_PASSWORD`、`NOVIQWIKI_BASE_URL` 或 `NOVIQWIKI_SECRET` 时立即失败，不会生成密钥或使用密钥卷。所有副本与重启都必须使用部署密钥管理器中的同一稳定 `NOVIQWIKI_SECRET`。首次安装完成后，应移除一次性 `NOVIQWIKI_SETUP_TOKEN` 并重启。

检查状态和日志：

```bash
docker compose ps
docker compose logs --tail=200 app
```

提交的服务名为 `app` 和 `db`。Compose 项目名下的命名卷为 `noviqwiki-db`、`noviqwiki-media` 和 `noviqwiki-backups`。`docker compose down` 会保留它们；`docker compose down -v` 会删除数据库、本地媒体和备份输出，在没有明确破坏性操作方案时不得对保留数据使用。生产部署应将 `NOVIQWIKI_SECRET` 保存在密钥管理器中。

### 强化生产 Compose

生产专用 Compose 或平台定义至少应：

- 使用唯一 PostgreSQL 凭据，或使用托管数据库。
- 保持 PostgreSQL 私有；主机开发仅使用 `compose.dev.yaml` 的回环映射。
- 从部署环境或密钥管理器注入 `DATABASE_URL`、`NOVIQWIKI_BASE_URL`、`NOVIQWIKI_SECRET`、媒体、SMTP、连接池和日志设置。
- 继续在缺少托管 `NOVIQWIKI_SECRET` 时让部署失败。
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

只通过 HTTPS 提供服务，并将 `NOVIQWIKI_BASE_URL` 设为外部 HTTPS 源。生产环境把它作为请求校验、重定向、邮件链接和引用的权威值，即使 PostgreSQL 中仍存在旧设置值。提交的应用端口只绑定到 `127.0.0.1:3000`；Compose 内的代理应通过私有网络访问 `app:3000`。

除应用校验外，还应在代理层设置请求大小、超时和限流。保留 CSP、`X-Content-Type-Options` 和 `X-Frame-Options` 等 Web 与 API 响应头。

### 健康检查

当前应用始终提供以下端点：

```text
GET /api/health
GET /api/ready
```

- `/api/health` 是进程存活响应，不查询 PostgreSQL。
- `/api/ready` 查询 PostgreSQL，并调用当前存储适配器的就绪检查。
- 本地与 S3 就绪检查都会执行有界写入/读取/删除探针。本地存储会先拒绝不安全或含链接的根目录；S3 使用 `.noviqwiki-readiness/` 前缀并删除精确探针对象/版本。

手动检查：

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

根据平台行为分别配置负载均衡器的存活与就绪探针。不要只用 `GET /` 作为就绪证据，因为它可能重定向到设置或登录页，也不能独立证明媒体可用。

### 静态资源与媒体

Next.js 静态资源已包含在独立镜像中。本地用户媒体必须位于 `NOVIQWIKI_MEDIA_ROOT` 指定的持久路径；提交的 Compose 文件将其挂载到 `/app/media`。

本地与 S3 媒体都通过同源 `/media/{key}` 路由授权并流式传输。公开站点响应使用 `Cache-Control: public, max-age=0, must-revalidate`，私有站点使用 `Cache-Control: private, no-store`。非内联安全类型作为附件返回，S3 签名不会被持久化或暴露。

对于兼容 S3 的存储：

- 使用私有、已启用版本控制且加密的存储桶。
- 将凭据权限限制到所需对象操作和存储桶前缀。
- 为媒体键和 `.noviqwiki-readiness/` 探针前缀授予对象读、写、删除权限；启用版本控制时还要允许删除精确探针版本。
- 在部署 CSP 下用真实浏览器验证代表性图片和文件，而不仅是直接请求存储桶。
- 独立备份存储桶；`pnpm backup` 不复制 S3 对象。

更改存储驱动不会迁移现有对象。修改 `NOVIQWIKI_MEDIA_DRIVER` 前必须规划并验证明确的对象迁移。

`pnpm backup` 始终创建 PostgreSQL 转储，并且仅对 `local` 驱动创建媒体 `.tar.gz` 归档。它不包含 S3 对象或部署密钥。操作前请阅读 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)。

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

1. 设置模式正确：没有站点时开放完整设置；站点没有活跃 Owner 时仅开放 Owner 恢复/引导；存在活跃 Owner 后关闭设置。
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
