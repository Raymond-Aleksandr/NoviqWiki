# Upgrading NoviqWiki

> [English](UPGRADING.md) | [简体中文](UPGRADING.md#简体中文)

Treat every NoviqWiki upgrade as an application, configuration, database, and media compatibility change unless the target release notes explicitly prove otherwise. Rehearse the exact path in staging before changing production.

## Versioning and Release Sources

The current repository version is `0.1.0` and the project is pre-1.0. Minor releases may change the schema, environment contract, stored rendering, or API. Use an identified source commit, release tag, or immutable image digest; do not deploy an unpinned moving branch or mutable image tag.

`pnpm install` by itself does not select a target NoviqWiki version. First switch the checkout or image reference to the intended release, then install that release's locked dependencies.

For source deployments, verify the selected commit:

```bash
git fetch --tags
git checkout <release-tag-or-commit>
git rev-parse HEAD
pnpm install --frozen-lockfile
```

Do not run these commands over an uncommitted production working tree. Build release artifacts in a controlled build environment.

## Before You Upgrade

1. Read the target release notes and `CHANGELOG.md` entries from every skipped version.
2. Confirm the target Node.js, pnpm, PostgreSQL, Docker, and browser-test requirements.
3. Compare `package.json`, `.env.example`, `compose.yaml`, `Dockerfile`, and deployment overrides with the installed version.
4. Review every new SQL file in `drizzle/`, including locks, backfills, defaults, indexes, and backward compatibility.
5. Back up PostgreSQL and the active local or S3 media store as one recovery point, and separately preserve the managed `NOVIQWIKI_SECRET`.
6. Record the running image digest or source commit and preserve the previous artifact.
7. Restore the backup into a separate environment and verify it.
8. Run the full target-version verification suite in staging with representative data.
9. Define the write-maintenance window, rollout ordering, success criteria, rollback decision point, and responsible operator.

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md). A backup that has never been restored is not sufficient rollback evidence.

## Configuration Review

Check for added, removed, renamed, defaulted, or newly required environment variables. In particular, preserve the stable `NOVIQWIKI_SECRET`, verify `DATABASE_URL`, and confirm all media and SMTP settings.

### NoviqWiki Identifier Migration

All project-owned environment variables now use the `NOVIQWIKI_*` prefix. The committed defaults also use `noviqwiki` for the PostgreSQL user and database, Compose volume keys, runtime operating-system account, E2E database, and target-bound operational labels. Earlier draft checkouts used a provisional internal identifier; those names are not accepted as aliases and Docker does not automatically treat their volumes as the new volumes.

For an earlier draft deployment, stop writes and preserve a verified recovery point before changing identifiers. Then:

1. Compare the deployment manifest with the target `.env.example` and rename every project-owned environment key.
2. Decide whether `DATABASE_URL` will continue to point at the existing PostgreSQL user/database or whether the backup will be imported into the new defaults. A customized existing target remains valid through `DATABASE_URL`; only the exact committed `noviqwiki@db:5432/noviqwiki` target uses Compose database tools.
3. Copy or restore retained local media and backup artifacts into the new volumes. A newly created empty Compose volume is not evidence that the earlier data was migrated.
4. Supply the previously managed secret through `NOVIQWIKI_SECRET`. Starting with a different secret invalidates existing sessions and outstanding recovery or verification tokens.
5. Run `docker compose config --quiet`, inspect the resolved volume attachments without exposing secret values, and rehearse the upgrade against a copy before changing production.

Verify that the upgraded production `NOVIQWIKI_BASE_URL` remains HTTPS and that session and CSRF cookies are secure before testing authentication. Local HTTP development may use non-secure cookies.

The committed Compose stack fails closed when `NOVIQWIKI_SECRET` is missing or empty. Keep one stable value in the deployment secret manager across every replica and restart.

Operational scripts load `.env` by default through `dotenv/config`, not `.env.local`. Export the production values through the deployment system; do not assume a Next.js local file will be used by migrations or search reindexing.

In production, `NOVIQWIKI_BASE_URL` is authoritative for request validation and generated links. Update it whenever the public origin changes; keep the stored site value aligned for development and test environments.

Changing `NOVIQWIKI_MEDIA_DRIVER` is a data migration, not a configuration-only change. Copy and verify every object before switching drivers.

## Source or Host Upgrade

From the selected target checkout:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

During the maintenance window, stop writes, export the exact target database URL, and apply migrations:

```bash
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki pnpm db:migrate
```

Start the target application only after the migration result is known. If the release notes require rebuilding derived search data, run:

```bash
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki pnpm search:reindex
```

`pnpm search:reindex` rebuilds the current site's search index. It is not a substitute for a schema migration and should not be run speculatively on a damaged database.

## Docker Compose Upgrade

The committed `compose.yaml` uses `build: .`; it does not reference a remote application image. Therefore `docker compose build` builds the **current checkout**, and `docker compose pull` does not select a target NoviqWiki application release for this file.

### Preserve credentials for existing volumes

The supplied Compose file no longer uses an implicit example database password or an ephemeral application signing secret. Before recreating containers, put the credentials for the existing database volume, the canonical base URL, and a stable application secret in `.env`:

```bash
POSTGRES_USER=noviqwiki
POSTGRES_DB=noviqwiki
POSTGRES_PASSWORD=current-database-password
DATABASE_URL=postgres://noviqwiki:current-database-password@db:5432/noviqwiki
NOVIQWIKI_BASE_URL=https://wiki.example.com
NOVIQWIKI_SECRET=replace-with-a-stable-32-byte-or-longer-secret
```

`POSTGRES_PASSWORD` contains the raw password used by the database container. `DATABASE_URL` is now
an independent, required Compose setting; it must be a complete URL using the private `db` service
host. Percent-encode reserved characters in the URL username or password (for example, encode `@`
as `%40`) while leaving `POSTGRES_PASSWORD` raw. Compose no longer interpolates the raw password
into the connection URL.

Keep an already configured `NOVIQWIKI_SECRET` unchanged. If an older container generated its secret at startup, generate and persist a new managed value now; existing sessions will be invalidated once, but subsequent restarts will keep sessions valid. `NOVIQWIKI_SETUP_TOKEN` is needed only for a database where initial Owner setup has not completed.

PostgreSQL applies `POSTGRES_PASSWORD` only when it initializes an empty data directory. Changing
the variable does not change the password inside an existing named volume. For an untouched volume
created by the older default Compose file, the current password is `noviqwiki`. Use that current
value for the first upgraded database start, then rotate it deliberately:

```bash
docker compose stop app
docker compose up -d db
docker compose exec db sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

At the `psql` prompt, run `\password` for the configured database user, enter a new random password
twice, and then run `\quit`. Update `POSTGRES_PASSWORD` in `.env` to the same raw value and update
the password component of `DATABASE_URL` to its percent-encoded form before starting the
application. Do not delete or recreate the database volume during this process.

Validate configuration:

```bash
docker compose config
```

Compose rejects a missing or empty `DATABASE_URL`, `POSTGRES_PASSWORD`, `NOVIQWIKI_BASE_URL`, or
`NOVIQWIKI_SECRET`. Set `NOVIQWIKI_BASE_URL` to the externally visible canonical origin, including
`https://` in production; it controls generated email links and same-origin validation for writes.

For the repository Compose path, check out the target source and build it:

```bash
git checkout <release-tag-or-commit>
export NOVIQWIKI_SECRET=<existing-stable-secret>
docker compose config --quiet
docker compose build
```

Back up data. The application image runs the migration runner under a PostgreSQL advisory lock
before starting the server. To apply migrations as an explicit Compose release step, use the
private service network rather than a host `DATABASE_URL`:

```bash
docker compose up -d db
docker compose run --rm --no-deps app node scripts/migrate.mjs
```

Then update services. Re-running the migration runner during application startup is safe and is a
no-op after the release migrations have been recorded:

```bash
docker compose up -d
```

Use `--quiet` because plain `docker compose config` renders resolved environment values, including the exported secret. Never capture that expanded output in an upgrade record.

Keep supplying the same managed `NOVIQWIKI_SECRET` on every subsequent start, and verify session and verification/reset-token continuity deliberately.

The stock Docker image runs `scripts/migrate.mjs` automatically before starting the standalone server. Its advisory lock serializes concurrent migration attempts. If the production deployment uses a dedicated migration job, customize the startup contract so the image does not create ambiguous duplicate migration ownership.

Inspect the rollout:

```bash
docker compose ps
docker compose logs --tail=200 app
```

For a production override that uses a published image, update the pinned tag or digest in that deployment definition, pull it, and verify the resolved configuration before rollout. Do not infer those steps from the committed build-only Compose file.

Never use `docker compose down -v` during an upgrade of retained data; it deletes the database, media, and backup named volumes.

The default application port is bound to `127.0.0.1:3000`. Keep that loopback binding when a reverse
proxy runs on the host. A proxy running in Compose should reach `app:3000` on the private service
network rather than publishing the application port on every host interface.

Older S3-backed revisions may contain persisted pre-signed object URLs. The upgraded application
maps those URLs to authorized same-origin `/media/...` routes while rendering current or historical
articles, visual revision diffs, editors, homepage covers, and activity links. Canonical revision
API responses keep the stored Markdown, HTML, and matching content hash unchanged; the compatibility
view does not rewrite immutable revision records.

## Post-Upgrade Checks

Verify all of the following before reopening normal writes or declaring success:

- `GET /api/health` and `GET /api/ready` return success.
- Existing setup remains complete and the expected site loads.
- Confirm that the upgraded site has an active Owner. A site with no active Owner intentionally opens Owner recovery/bootstrap while preserving existing users, content, and settings; keep the deployment isolated until an authorized Owner completes it and setup returns to completed mode.
- Login and logout work through the production HTTPS origin.
- Public and restricted pages enforce the expected access policy.
- Existing Markdown renders from stored sanitized HTML.
- Editing a page creates a new immutable revision; history, comparison, and rollback UI load.
- Search returns existing and newly edited content; category filters and aliases behave correctly.
- Local or S3 media loads in a browser and a new upload succeeds when enabled.
- Admin routes reject a user without the required permission.
- SMTP delivery and recovery URLs are correct when email is enabled.
- Audit views, logs, metrics, and backup monitoring show no new failure.

Compare key database row counts and media inventory with the pre-upgrade baseline. Keep the maintenance window and previous artifact available until these checks pass.

## Rollback Decision

Classify the database change before choosing a rollback:

- **No migration applied:** redeploy the previous pinned application artifact and restore its configuration.
- **Only backward-compatible migration applied:** redeploy the previous artifact only after explicitly confirming that its code tolerates the new schema.
- **Destructive or incompatible migration applied:** stop writes, restore the pre-upgrade PostgreSQL backup and matching media state, then deploy the previous artifact.
- **Rendering or indexing changed:** use the target release's documented reindex or data procedure; do not assume an old application can consume newly derived stored content.

The repository has forward Drizzle migrations and no general automatic down-migration command. Do not improvise reverse SQL in production.

The project restore command is destructive and requires explicit variables:

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql \
NOVIQWIKI_RESTORE_MEDIA=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038-media.tar.gz \
NOVIQWIKI_RESTORE_CONFIRM=restore:localhost:5432/noviqwiki \
pnpm restore
```

The confirmation above matches the repository's default host database URL; use the exact `restore:<host>:<port>/<database>` label required for the actual target. An omitted URL port is normalized to `5432`. The command accepts the plain `.sql` output from `pnpm backup`, not a custom-format `.dump`. Read [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) and verify the target before using it.

After rollback, rerun health, login, authorization, page read/edit/history/search, and media checks before restoring traffic.

## Data Migrations

Any application-level data migration must be:

- Idempotent or explicitly guarded against repeated execution.
- Restartable, with progress or checkpoint behavior for long runs.
- Tested against a representative copy and production-scale volume.
- Observable without logging content, credentials, or sensitive identifiers unnecessarily.
- Coordinated with application-version compatibility and write traffic.
- Paired with a rollback or restore procedure and acceptance checks.

Do not perform long-running data rewrites in request handlers or an unbounded application startup hook.

## Dependency and Framework Upgrades

For contributor-driven dependency upgrades:

- Preserve TypeScript strictness and supported Node.js engines.
- Review framework migration notes and security advisories.
- Inspect lockfile changes and native/build-script dependencies.
- Run `pnpm typecheck`, unit tests, integration tests, build, e2e, and relevant live UI audits.
- Review sanitizer, Markdown, diff, database driver, session, and AWS SDK changes carefully.
- Rebuild and scan the container, then verify standalone static/public assets.
- Update English and Simplified Chinese documentation together when commands, defaults, or behavior change.

Stored HTML and search text are derived from Markdown. A renderer or sanitizer upgrade may require an intentional re-render/reindex plan rather than waiting for future edits to change only some pages.

## API Documentation

When a release changes route contracts, update the API documentation source and regenerate the tracked OpenAPI artifact:

```bash
pnpm openapi
```

Review the resulting `docs/openapi.json` diff and verify the implemented handlers. Generation alone does not prove runtime compatibility or authorization behavior.

## Upgrade Record

Retain an operator record containing:

- Source version, target version, commit, and image digest.
- Backup identifiers and successful restore-drill reference.
- Configuration and migration review.
- Start/end times and write-maintenance window.
- Exact commands and results.
- Post-upgrade validation evidence.
- Rollback decision and any known follow-up work.

---

## 简体中文

> [English](UPGRADING.md) | [简体中文](UPGRADING.md#简体中文)

除非目标版本说明明确证明不涉及，否则每次 NoviqWiki 升级都应视为应用、配置、数据库和媒体兼容性变更。在修改生产环境前，先在预发布环境演练完全相同的路径。

### 版本与发布来源

当前仓库版本为 `0.1.0`，项目仍处于 1.0 之前。次版本可能改变架构、环境契约、已存储渲染结果或 API。使用可识别的源代码提交、发布标签或不可变镜像摘要；不要部署未固定的移动分支或可变镜像标签。

仅运行 `pnpm install` 不会选择目标 NoviqWiki 版本。必须先把检出或镜像引用切换到计划版本，再安装该版本锁定的依赖。

源代码部署应验证选定提交：

```bash
git fetch --tags
git checkout <release-tag-or-commit>
git rev-parse HEAD
pnpm install --frozen-lockfile
```

不要在含未提交修改的生产工作树上执行这些命令。发布制品应在受控构建环境中生成。

### 升级前

1. 阅读目标版本以及每个跳过版本的发布说明和 `CHANGELOG.md`。
2. 确认目标 Node.js、pnpm、PostgreSQL、Docker 和浏览器测试要求。
3. 将 `package.json`、`.env.example`、`compose.yaml`、`Dockerfile` 和部署覆盖与已安装版本比较。
4. 检查 `drizzle/` 中每个新 SQL 文件，包括锁、回填、默认值、索引和向后兼容性。
5. 将 PostgreSQL 与当前本地或 S3 媒体存储作为同一个恢复点备份，并单独保留受管 `NOVIQWIKI_SECRET`。
6. 记录运行中的镜像摘要或源提交并保留旧制品。
7. 将备份恢复到独立环境并验证。
8. 使用代表性数据在预发布环境运行目标版本的完整验证套件。
9. 定义写入维护窗口、发布顺序、成功标准、回滚决策点和负责人。

另见 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)。从未成功恢复过的备份不足以作为回滚证据。

### 配置审查

检查新增、删除、重命名、默认化或新近变为必填的环境变量。尤其要保留稳定的 `NOVIQWIKI_SECRET`，核对 `DATABASE_URL`，并确认所有媒体和 SMTP 设置。

#### NoviqWiki 标识迁移

所有项目专属环境变量现统一使用 `NOVIQWIKI_*` 前缀。仓库默认配置也统一以 `noviqwiki` 作为 PostgreSQL 用户与数据库、Compose 卷键、运行时操作系统账户、E2E 数据库及目标绑定运维标签。更早草稿检出使用了临时内部标识；当前版本不会把那些名称作为别名，Docker 也不会自动把旧卷视为新卷。

升级更早草稿部署时，应先停止写入并保留经过验证的恢复点，然后：

1. 将部署清单与目标版本 `.env.example` 对比，重命名所有项目专属环境变量键。
2. 决定 `DATABASE_URL` 是继续指向现有 PostgreSQL 用户/数据库，还是把备份导入新默认目标。自定义现有目标仍可使用；只有精确的 `noviqwiki@db:5432/noviqwiki` 目标使用 Compose 数据库工具。
3. 将保留的本地媒体和备份制品复制或恢复到新卷。新建的空 Compose 卷不能证明旧数据已经迁移。
4. 通过 `NOVIQWIKI_SECRET` 提供此前受管的密钥。使用不同密钥启动会使现有会话以及尚未使用的恢复/验证令牌失效。
5. 运行 `docker compose config --quiet`，在不暴露密钥值的前提下检查解析后的卷挂载，并先针对副本演练升级，再修改生产环境。

测试身份验证前，应确认升级后的生产 `NOVIQWIKI_BASE_URL` 仍为 HTTPS，且会话与 CSRF Cookie 均为安全 Cookie。本地 HTTP 开发可使用非安全 Cookie。

缺少或清空 `NOVIQWIKI_SECRET` 时，提交的 Compose 栈会立即失败。所有副本与重启都必须持续使用部署密钥管理器中的同一稳定值。

运维脚本通过 `dotenv/config` 默认加载 `.env`，不是 `.env.local`。应通过部署系统导出生产值；不要假设迁移或搜索重建会使用 Next.js 本地文件。

生产环境中 `NOVIQWIKI_BASE_URL` 是请求校验和生成链接的权威源；公共源变化时必须更新它，开发与测试环境还应保持站点存储值一致。

更改 `NOVIQWIKI_MEDIA_DRIVER` 属于数据迁移，不是单纯配置变更。切换驱动前必须复制并验证每个对象。

### 源代码或主机升级

在选定目标检出中运行：

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

维护窗口期间停止写入，导出准确的目标数据库 URL 并应用迁移：

```bash
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki pnpm db:migrate
```

只有确认迁移结果后才启动目标应用。如果发布说明要求重建派生搜索数据，运行：

```bash
DATABASE_URL=postgres://noviqwiki:secret@postgres.example.com:5432/noviqwiki pnpm search:reindex
```

`pnpm search:reindex` 重建当前站点的搜索索引。它不能替代架构迁移，也不应在受损数据库上试探性运行。

### Docker Compose 升级

提交的 `compose.yaml` 使用 `build: .`，不引用远程应用镜像。因此 `docker compose build` 构建的是**当前检出**，而 `docker compose pull` 无法为该文件选择目标 NoviqWiki 应用版本。

仓库 Compose 评估路径：

```bash
git checkout <release-tag-or-commit>
export NOVIQWIKI_SECRET=<existing-stable-secret>
docker compose config --quiet
docker compose build
docker compose up -d
```

应使用 `--quiet`，因为普通的 `docker compose config` 会渲染解析后的环境变量值，包括已导出的密钥。不得把这类展开后的输出保存到升级记录中。

后续每次启动都必须继续提供同一受管 `NOVIQWIKI_SECRET`，并明确验证会话以及验证/重置令牌的连续性。

原始 Docker 镜像会在启动独立服务器前自动运行 `scripts/migrate.mjs`，其 advisory lock 会串行处理并发迁移尝试。如果生产部署使用专用迁移任务，应自定义启动契约，避免镜像产生含糊的重复迁移责任。

检查发布：

```bash
docker compose ps
docker compose logs --tail=200 app
```

若生产覆盖使用已发布镜像，应在部署定义中更新固定标签或摘要，拉取镜像，并在发布前验证解析后的配置。不要从提交的仅构建 Compose 文件推断这些步骤。

升级保留数据时绝不能使用 `docker compose down -v`；它会删除数据库、媒体和备份命名卷。

### 升级后检查

重新开放正常写入或宣布成功前，验证以下全部项目：

- `GET /api/health` 和 `GET /api/ready` 成功。
- 现有设置保持完成，预期站点可以加载。
- 确认升级后的站点存在活跃 Owner。没有活跃 Owner 的站点会有意打开 Owner 恢复/引导流程，并保留现有用户、内容和设置；在获授权 Owner 完成流程、设置回到已完成模式前，必须让部署与不受信任网络隔离。
- 通过生产 HTTPS 源登录和退出正常。
- 公共和受限页面执行预期访问策略。
- 现有 Markdown 从已存储的清理 HTML 正常渲染。
- 编辑页面会创建新不可变修订；历史、比较和回滚 UI 可以加载。
- 搜索返回现有和新编辑内容；分类筛选和别名行为正确。
- 本地或 S3 媒体可在浏览器加载；启用上传时新上传成功。
- 没有所需权限的用户被管理路由拒绝。
- 启用邮件时，SMTP 投递和恢复 URL 正确。
- 审计视图、日志、指标和备份监控没有新故障。

将关键数据库行数和媒体清单与升级前基线比较。在这些检查通过前，保持维护窗口并保留旧制品。

### 回滚决策

选择回滚方式前，先对数据库变更分类：

- **未应用迁移：**重新部署固定的旧应用制品并恢复其配置。
- **只应用向后兼容迁移：**仅在明确确认旧代码容忍新架构后重新部署旧制品。
- **已应用破坏性或不兼容迁移：**停止写入，恢复升级前 PostgreSQL 备份和匹配媒体状态，再部署旧制品。
- **渲染或索引发生变化：**使用目标版本记录的重建或数据流程；不要假设旧应用能够读取新的派生存储内容。

仓库只有向前的 Drizzle 迁移，没有通用自动向下迁移命令。不要在生产环境临时编写反向 SQL。

项目恢复命令具有破坏性，并要求显式变量：

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql \
NOVIQWIKI_RESTORE_MEDIA=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038-media.tar.gz \
NOVIQWIKI_RESTORE_CONFIRM=restore:localhost:5432/noviqwiki \
pnpm restore
```

以上确认值对应仓库默认的主机数据库 URL；实际操作必须使用目标所要求的准确 `restore:<host>:<port>/<database>` 标签，URL 省略端口时会规范为 `5432`。该命令接受 `pnpm backup` 生成的纯文本 `.sql`，不接受自定义格式 `.dump`。使用前阅读 [BACKUP_RESTORE.md](./BACKUP_RESTORE.md) 并确认目标。

回滚后，在恢复流量前重新执行健康、登录、授权、页面读取与编辑、历史、搜索和媒体检查。

### 数据迁移

任何应用级数据迁移都必须：

- 幂等，或明确防止重复执行。
- 可重启，并为长任务提供进度或检查点。
- 针对代表性副本和生产规模数据量测试。
- 可观测，同时避免不必要地记录内容、凭据或敏感标识。
- 与应用版本兼容性和写入流量协调。
- 配备回滚或恢复流程及验收检查。

不要在请求处理程序或无界应用启动钩子中执行长时间数据重写。

### 依赖与框架升级

贡献者升级依赖时：

- 保持 TypeScript 严格性和支持的 Node.js 引擎。
- 阅读框架迁移说明和安全公告。
- 检查锁文件变化以及原生或构建脚本依赖。
- 运行 `pnpm typecheck`、单元测试、集成测试、构建、e2e 和相关在线 UI 审计。
- 仔细审查清理器、Markdown、差异、数据库驱动、会话和 AWS SDK 变化。
- 重新构建并扫描容器，然后验证独立静态与公共资源。
- 命令、默认值或行为变化时同步更新英文和简体中文文档。

已存储 HTML 和搜索文本由 Markdown 派生。渲染器或清理器升级可能需要有计划的重新渲染和重建索引，而不能等待未来编辑只改变部分页面。

### API 文档

发布版本更改路由契约时，应更新 API 文档源并重新生成跟踪的 OpenAPI 制品：

```bash
pnpm openapi
```

检查生成的 `docs/openapi.json` 差异，并验证实际处理程序。仅生成文件不能证明运行时兼容性或授权行为。

### 升级记录

保留包含以下信息的运维记录：

- 源版本、目标版本、提交和镜像摘要。
- 备份标识和成功恢复演练引用。
- 配置和迁移审查。
- 开始与结束时间以及写入维护窗口。
- 准确命令和结果。
- 升级后验证证据。
- 回滚决策和任何已知后续工作。
