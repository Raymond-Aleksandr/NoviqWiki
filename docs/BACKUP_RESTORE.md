# NoviqWiki Backup and Restore

> [English](BACKUP_RESTORE.md) | [简体中文](BACKUP_RESTORE.md#简体中文)

NoviqWiki stores authoritative application data in PostgreSQL. Uploaded media is stored either on the local filesystem or in S3-compatible object storage. A recoverable backup must cover the database, the active media backend, and the deployment information needed to run the matching application version.

## Safety and Prerequisites

- Run backup and restore commands from the repository host with the target environment variables exported. The TypeScript scripts load `.env` through `dotenv/config`; they do not automatically load `.env.local`. See [CONFIGURATION.md](./CONFIGURATION.md#environment-files).
- The scripts strictly parse the resolved `DATABASE_URL` before invoking database tools: it must use `postgres://` or `postgresql://`, include one host, and identify exactly one database. Target- or credential-overriding query parameters are rejected, an omitted port is normalized to `5432`, and ambient libpq routing variables are removed from child processes. Database passwords are never put in process arguments.
- Database tooling is selected by the validated target. The exact Compose `noviqwiki@db:5432/noviqwiki` target uses container tools; every other target requires local PostgreSQL client tools. A failing local command is never retried against a different database.
- The runtime image does not install PostgreSQL client tools or the Docker CLI. Do not assume that `docker compose exec app pnpm backup` or `docker compose exec app pnpm restore` will work.
- A restore is destructive. Resolve and verify the exact database URL, SQL file, media archive, bucket, and application version before starting.
- The supplied Compose workflow automatically stops and restarts a running application for a database-plus-local-media snapshot or restore. For every other local-media deployment, stop application writes and provide the explicit quiescence acknowledgement described below.

## Backup Scope

Back up all of the following:

- PostgreSQL, including the Drizzle migration journal.
- Uploaded media from the configured local directory or S3-compatible bucket.
- The deployment environment and secret references needed to recreate the service. Store secret values only in an approved encrypted secret system; `pnpm backup` does not copy deployment secrets.
- The application release tag, commit, or immutable container image digest.
- The `drizzle/` migration files from that application version.
- Provider-specific configuration such as bucket versioning, lifecycle, encryption, and database point-in-time-recovery settings.

The database contains media metadata, but it does not contain the uploaded objects themselves.

## Backup Frequency

A reasonable production baseline is:

- Daily full database backups.
- Point-in-time recovery when the PostgreSQL provider supports it.
- Daily media inventory, snapshot, or bucket replication.
- A restore drill before every major release and at least monthly.

Set the actual schedule from the site's recovery point objective (RPO) and recovery time objective (RTO). Monitor backup failures and verify retained backups with checksums or provider integrity controls.

## Project Backup Command

Run the project command from the repository host:

```bash
NOVIQWIKI_BACKUP_DIR=backups pnpm backup
```

For the supplied Compose deployment, the command recognizes the exact `db` target, streams
`pg_dump` from the database container, and streams local media from the `noviqwiki-media` volume
through a one-off application container. If the application service is running, it is stopped for
the database-plus-local-media snapshot and restarted afterward so writes cannot split the pair.
Both conditions are required: a configured `/app/media` path alone does not select Compose tools
when the database is external. Bare-metal, Kubernetes, and external-database deployments therefore
use the configured path directly and require the explicit quiescence acknowledgement below.

For a non-Compose local-media deployment, stop all application writers first and acknowledge that
state explicitly:

```bash
NOVIQWIKI_BACKUP_QUIESCED=true pnpm backup
```

New backup directories are created with mode `0700`; an existing directory must already be mode
`0700` or stricter and is never chmodded by the command. SQL and media files are created exclusively
with mode `0600`. The backup and local-media directories must not overlap, which prevents an archive
from including itself or earlier backups. A failed database or media step removes both partial
outputs. Keep raw database and object-storage procedures documented as a fallback.

For the exact Compose database target, the containerized `pg_dump` output is streamed directly to
disk, so dump size is not constrained by a child-process memory buffer.

- `backups/noviqwiki-<timestamp>-<run-id>.sql`: a plain-text SQL dump produced by `pg_dump`.
- `backups/noviqwiki-<timestamp>-<run-id>-media.tar.gz`: a local-media archive, only when `NOVIQWIKI_MEDIA_DRIVER=local`.

`pnpm backup` accepts only `local` or `s3` as `NOVIQWIKI_MEDIA_DRIVER`. With the local driver, `NOVIQWIKI_MEDIA_ROOT` must already be a readable and searchable dedicated media directory. The script rejects filesystem roots, home/workspace ancestors, linked trees, and overlapping media/backup paths. It does **not** create a custom-format PostgreSQL dump, copy S3 objects, export environment variables, copy deployment secrets, or encrypt its output.

Each run receives a UUID suffix so concurrent invocations do not share output names. The generated SQL is checked for the NoviqWiki plain-dump markers used by restore, and a local-media archive is relisted through the same safe-member checks used by restore. Any failed or unrecognized database or media step removes both outputs so the run cannot leave an apparently complete recovery point. Verify the source identity, output modes, sizes, and representative row counts.

Record both generated filenames together. A database backup without its matching media backup is not a complete recovery point.

## Manual PostgreSQL Backup

For a portable compressed custom-format dump:

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=noviqwiki \
PGDATABASE=noviqwiki \
PGSSLMODE=require \
pg_dump --format=custom --no-owner --no-acl --file=backups/noviqwiki-$(date +%Y%m%d%H%M%S).dump
```

Put the password in a mode-`0600` libpq `.pgpass` file, a `PGPASSFILE` supplied by the deployment
secret store, or an equivalently protected service definition. Do not pass a password-bearing
`DATABASE_URL` as a command argument: command lines may be visible to other local processes. For
large databases, run backups from infrastructure close to the database and monitor duration.

## Media Backup

For local media, archive the exact directory configured by `NOVIQWIKI_MEDIA_ROOT`. The project backup command does this automatically when the local driver is active.

For S3-compatible storage, use bucket replication/versioning or a provider-supported backup. A manual AWS CLI example is:

```bash
aws s3 sync s3://noviqwiki-assets backups/media/noviqwiki-assets
```

For a non-AWS provider, include its required `--endpoint-url` and profile or credential mechanism. Confirm that object versions, delete markers, encryption keys, and lifecycle rules meet the recovery plan; a simple sync may not preserve all of them.

## Restore Order

1. Stop writes to the damaged environment.
2. Identify the matching database backup, media backup, application version, and migration set.
3. Provision a clean target PostgreSQL database and media destination.
4. Restore PostgreSQL with either the project plain-SQL path or the custom-format path. Do not mix the two formats.
5. Restore local media or the S3-compatible bucket.
6. Deploy the matching NoviqWiki application version.
7. Run migrations only when intentionally moving the restored data to a newer application version.
8. Validate the restored service before reopening writes.

Prefer a new recovery database over overwriting the only copy of a damaged database. Preserve the original until the recovery has been accepted.

## Manual Restore: Custom Format

Create the target database, then restore:

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=noviqwiki \
PGDATABASE=noviqwiki \
PGSSLMODE=require \
pg_restore --clean --if-exists --no-owner --no-acl backup/noviqwiki.dump
```

Use the same protected `.pgpass`/`PGPASSFILE` approach as backup, and verify every non-secret
target variable before starting. Use `--clean --if-exists` only when the target database is
disposable or intentionally being replaced. For production recovery, confirm the target before
running the command.

## Project Restore Command: Plain SQL

Use the project restore command when available:

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki.sql \
NOVIQWIKI_RESTORE_MEDIA=backups/noviqwiki-media.tar.gz \
NOVIQWIKI_RESTORE_CONFIRM='restore:noviqwiki@db:5432/noviqwiki:media=%2Fapp%2Fmedia' \
pnpm restore
```

The confirmation is derived from the parsed database username, host, port, and database name; the
command prints the exact required value when it is absent or wrong. When
`NOVIQWIKI_RESTORE_MEDIA` is set, confirmation also includes the percent-encoded canonical absolute
local-media root (the fixed `/app/media` volume path for Compose). A database-only confirmation
cannot therefore authorize recursive replacement of a media tree, and confirmation for one media
root cannot authorize replacement of another. A generic `restore` value is intentionally rejected,
so confirmation for one target cannot authorize dropping another target.

The command copies SQL into a private staging directory, then verifies that the staged file is
readable, has the `pg_dump` header, and ends with the `pg_dump` completion marker before touching the
database. Schema reset and restore run in one explicit transaction with `ON_ERROR_STOP`; `COMMIT` is
sent only after the entire staged dump has been read successfully. An SQL or source-read failure
therefore rolls the reset back instead of leaving an empty or partially restored database.
Local media archives are validated before the database restore begins. Absolute/traversal paths,
symbolic links, hard links, devices, and other non-regular entries are rejected. Media is extracted
to a private staging directory and promoted with the previous tree retained; if SQL restoration
fails, the previous media tree is put back. The Compose path performs the same staged promotion in
the named media volume and automatically stops/restarts a running application service. Compose
media-volume operations are selected only when the validated database target is also the exact
Compose `db` service; `/app/media` by itself never redirects an external-database restore into the
current checkout's Compose volume.

For a non-Compose database or any local-media path that is not the database-bound Compose volume,
stop application writes and add `NOVIQWIKI_RESTORE_QUIESCED=true`. `NOVIQWIKI_MEDIA_ROOT` must resolve
to a dedicated directory; filesystem roots, home/workspace ancestors, linked trees, and non-regular
files are rejected.
The exact canonical absolute root is bound into `NOVIQWIKI_RESTORE_CONFIRM` and is checked again
immediately before promotion. This explicit binding is the destructive-operation boundary; broad
but otherwise valid paths such as a directory below the home or workspace are never authorized by
the database-only confirmation. Confirm the target environment before running restore commands; a
successful restore intentionally replaces existing data.

Database tooling is selected by the validated target, not by whether a host binary happens to be
installed. The exact Compose `db` target always uses container tools; every other target requires
local PostgreSQL client tools. A failing local command is never silently replaced with a dump from
another database. Target-changing URL query parameters are rejected, and non-Compose client
commands remove the database password from their process arguments. Structural dump checks prevent accidental wrong-format or truncated input, but do not authenticate SQL; restore only trusted, integrity-verified backups.

## Media Restore

For S3-compatible storage:

```bash
aws s3 sync backups/media/noviqwiki-assets s3://noviqwiki-assets
```

Use the provider's required endpoint and authentication options. Avoid `--delete` unless the recovery plan explicitly requires the destination to be made identical and the target bucket has been independently verified.

For local media restored outside the project script, extract into the configured persistent `NOVIQWIKI_MEDIA_ROOT`, then restore the correct ownership and permissions for the application user.

## Restore Validation

First verify liveness and readiness:

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

Then validate all of the following in the application:

If the restored database contains a site but no active Owner, NoviqWiki intentionally exposes `/setup` in Owner recovery/bootstrap mode. Public registration remains blocked, but the first setup visitor can recover the Owner role. Keep the service on a trusted or access-restricted network until an authorized operator completes recovery. Existing users, pages, media, and settings are preserved; confirm that `/setup` closes afterward before exposing normal traffic.

- An administrator can sign in and sign out.
- Public pages render, and restricted pages remain inaccessible to unauthorized users.
- A page edit creates a new immutable revision; history, comparison, and rollback controls load.
- Search returns restored content. Run `pnpm search:reindex` only if the target release requires rebuilding derived search data.
- Representative local or S3-backed media loads through NoviqWiki, and a new upload works when uploads are enabled.
- Email delivery, storage-provider functions, audit views, and the configured base URL behave as expected.

Compare important row counts and media inventories with the source recovery point. Document the backup timestamp, restore timestamp, application version, commands, operator, validation results, and any known data-loss window.

## Encryption, Access, and Retention

Encrypt backups at rest and in transit. Limit access to operators authorized for the production data, and keep encryption keys separate from the backup objects.

Example retention baseline:

- Daily backups retained for 14 days.
- Weekly backups retained for 8 weeks.
- Monthly backups retained for 12 months.

Adjust retention for legal, privacy, compliance, storage, and product requirements. Test deletion and legal-hold procedures as well as restoration.

## Disaster Recovery Notes

Keep an outage-accessible copy of the restore runbook outside this repository. Store provider recovery steps, contact paths, credentials, and encryption-key recovery in the organization's approved secret and incident systems. A backup is not considered reliable until a representative restore has succeeded.

---

## 简体中文

> [English](BACKUP_RESTORE.md) | [简体中文](BACKUP_RESTORE.md#简体中文)

NoviqWiki 将权威业务数据存储在 PostgreSQL 中。上传的媒体文件则存储在本地文件系统或兼容 S3 的对象存储中。可恢复的备份必须同时覆盖数据库、当前使用的媒体后端，以及运行对应应用版本所需的部署信息。

### 安全要求与前置条件

- 请在仓库所在主机上执行备份和恢复命令，并先导出目标环境所需的环境变量。TypeScript 脚本通过 `dotenv/config` 加载 `.env`，不会自动加载 `.env.local`。详见 [CONFIGURATION.md](./CONFIGURATION.md#环境文件)。
- 脚本会严格解析最终的 `DATABASE_URL`，拒绝覆盖目标或凭据的查询参数，规范省略的端口，移除 libpq 路由覆盖，并防止密码进入进程参数。数据库工具由已验证目标决定：精确的 Compose `noviqwiki@db:5432/noviqwiki` 目标使用容器工具，其他目标必须安装本地 PostgreSQL 客户端；本地命令失败后绝不会切换到另一数据库。
- 运行时镜像没有安装 PostgreSQL 客户端工具或 Docker CLI。不要假定 `docker compose exec app pnpm backup` 或 `docker compose exec app pnpm restore` 可以正常工作。
- 恢复属于破坏性操作。开始前必须确认准确的数据库 URL、SQL 文件、媒体归档、存储桶和应用版本。
- Compose 流程会在数据库与本地媒体联合备份或恢复期间自动停止并重启运行中的应用。其他本地媒体部署必须停止应用写入，并提供下文所述的显式静默确认。

### 备份范围

请备份以下全部内容：

- PostgreSQL 数据库，包括 Drizzle 迁移日志。
- 配置的本地目录或兼容 S3 的存储桶中的上传媒体。
- 重建服务所需的部署环境和密钥引用。密钥值只能保存在获批的加密密钥系统中；`pnpm backup` 不复制部署密钥。
- 应用发布标签、提交版本或不可变容器镜像摘要。
- 对应应用版本的 `drizzle/` 迁移文件。
- 提供商相关配置，例如存储桶版本控制、生命周期、加密和数据库时间点恢复设置。

数据库包含媒体元数据，但不包含上传对象本身。

### 备份频率

建议的生产环境基线如下：

- 每天执行完整数据库备份。
- PostgreSQL 提供商支持时启用时间点恢复。
- 每天执行媒体清单、快照或存储桶复制。
- 每次主要版本发布前以及至少每月执行一次恢复演练。

实际计划应依据站点的恢复点目标（RPO）和恢复时间目标（RTO）制定。监控备份失败，并通过校验和或提供商完整性控制验证保留的备份。

### 项目备份命令

请在仓库所在主机上运行：

```bash
NOVIQWIKI_BACKUP_DIR=backups pnpm backup
```

精确 Compose 数据库目标会从数据库容器流式执行 `pg_dump`，并通过一次性应用容器从 `noviqwiki-media` 卷流式读取本地媒体；若应用正在运行，会在联合快照期间停止并在结束后重启。非 Compose 本地媒体部署必须先停止所有写入并显式确认：

```bash
NOVIQWIKI_BACKUP_QUIESCED=true pnpm backup
```

新备份目录权限为 `0700`；已存在目录必须已经是 `0700` 或更严格。SQL 与媒体文件独占创建为 `0600`。备份目录与媒体目录不得重叠；任一步骤失败都会删除两个不完整产物。该命令会创建：

- `backups/noviqwiki-<timestamp>-<run-id>.sql`：由 `pg_dump` 生成的纯文本 SQL 转储。
- `backups/noviqwiki-<timestamp>-<run-id>-media.tar.gz`：仅在 `NOVIQWIKI_MEDIA_DRIVER=local` 时生成的本地媒体归档。

`pnpm backup` 只接受 `local` 或 `s3`。使用本地驱动时，媒体根目录必须是专用、可读、可遍历、无链接的目录，不能是文件系统根、主目录/工作区祖先或与备份目录重叠。它**不会**生成 PostgreSQL 自定义格式转储，不会复制 S3 对象、导出环境变量、复制部署密钥或加密输出。

每次运行都有 UUID 后缀。生成的 SQL 会检查 NoviqWiki 纯转储标记，本地媒体归档也会重新执行安全成员校验。数据库或媒体步骤失败时会同时删除两个产物，避免留下看似完整的恢复点。生产部署还应核对来源、权限、大小和代表性行数。

应将两个生成文件名作为同一个恢复点记录。只有数据库而没有对应媒体的备份并不完整。

### 手动备份 PostgreSQL

若需可移植的压缩自定义格式转储：

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=noviqwiki \
PGDATABASE=noviqwiki \
PGSSLMODE=require \
pg_dump --format=custom --no-owner --no-acl --file=backups/noviqwiki-$(date +%Y%m%d%H%M%S).dump
```

密码应放在权限为 `0600` 的 `.pgpass`、部署密钥系统提供的 `PGPASSFILE` 或等效受保护服务定义中。不要把含密码的 `DATABASE_URL` 放到命令参数中。大型数据库应在靠近 PostgreSQL 的基础设施中执行转储并监控耗时。

### 媒体备份

本地媒体必须归档 `NOVIQWIKI_MEDIA_ROOT` 配置的准确目录。启用本地驱动时，项目备份命令会自动完成此操作。

对于兼容 S3 的存储，优先使用存储桶复制、版本控制或提供商支持的备份。AWS CLI 手动示例：

```bash
aws s3 sync s3://noviqwiki-assets backups/media/noviqwiki-assets
```

非 AWS 提供商需要加入相应的 `--endpoint-url` 以及配置文件或凭据机制。确认对象版本、删除标记、加密密钥和生命周期规则符合恢复方案；简单同步不一定能保留这些信息。

### 恢复顺序

1. 停止受损环境的写入。
2. 确认相互匹配的数据库备份、媒体备份、应用版本和迁移集。
3. 创建干净的目标 PostgreSQL 数据库和媒体目的地。
4. 根据备份格式选择项目纯 SQL 流程或自定义格式流程恢复 PostgreSQL，不要混用。
5. 恢复本地媒体或兼容 S3 的存储桶。
6. 部署与备份匹配的 NoviqWiki 应用版本。
7. 只有在明确计划将恢复数据升级到较新应用版本时才运行迁移。
8. 验证恢复后的服务，再重新开放写入。

优先使用新的恢复数据库，不要覆盖受损数据库的唯一副本。在恢复结果验收前保留原始数据。

### 项目恢复命令：纯 SQL

仅运行 `pnpm restore` 不足以完成恢复。脚本要求 SQL 路径和与最终目标绑定的确认值；缺少或错误时会打印所需精确值。例如恢复精确 Compose 目标及本地媒体：

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki.sql \
NOVIQWIKI_RESTORE_MEDIA=backups/noviqwiki-media.tar.gz \
NOVIQWIKI_RESTORE_CONFIRM='restore:noviqwiki@db:5432/noviqwiki:media=%2Fapp%2Fmedia' \
pnpm restore
```

接受确认值或重置任何 Schema 前，脚本会完成以下全部检查：

- `DATABASE_URL` 必须通过上文所述的严格 PostgreSQL 目标解析，且 `NOVIQWIKI_MEDIA_DRIVER` 必须为 `local` 或 `s3`。
- `NOVIQWIKI_RESTORE_SQL` 必须是可读、非空的普通文件，并被识别为完整的 NoviqWiki 纯文本 `pg_dump`。检查要求存在 PostgreSQL 转储头、预期的 `sites` 和 `users` 表定义以及转储完成标记；截断转储、自定义 `.dump` 文件和任意 SQL 都会被拒绝。
- 若设置了 `NOVIQWIKI_RESTORE_MEDIA`，媒体驱动必须为 `local`，归档必须是至少包含一个成员的可读普通文件。tar 预检会拒绝绝对路径、父目录穿越、反斜杠或控制字符路径，以及除普通文件和目录之外的所有成员类型，包括符号链接和硬链接。
- 已验证目标精确匹配 Compose `db` 服务时使用容器工具；其他目标必须使用本地 PostgreSQL 客户端。任何失败都会停止，不会切换目标。

完整预检通过后，`NOVIQWIKI_RESTORE_CONFIRM` 必须精确绑定解析后的数据库用户、主机、端口和数据库；提供媒体归档时还必须包含经百分号编码的规范媒体根目录。数据库专用确认不能授权递归替换媒体树，另一个媒体根目录的确认也不能复用。

完成确认后但仍在重置数据库前，脚本只会在已提供媒体归档时创建或解析 `NOVIQWIKI_MEDIA_ROOT`，并拒绝与备份检查相同的不安全宽泛目的地。脚本会打开 SQL 文件，确认其设备、inode、大小和时间戳仍与预检结果一致。然后执行：

```sql
drop schema if exists public cascade;
drop schema if exists drizzle cascade;
create schema public;
```

这会清除目标数据库中的应用架构。脚本会把重置 SQL 和纯转储输入传给同一个主机或 Compose `psql` 调用，并使用 `-X`、`ON_ERROR_STOP=1` 和 `--single-transaction`。凭据、连接、重置和 SQL 失败都会停止，且不会切换目标；导入失败会回滚 Schema 重置，而不会留下空数据库。

数据库工具由已验证目标选择；非 Compose 目标必须安装 `psql`，本地命令失败后不会改用另一个数据库。对于单独创建的空生产目标，可按以下方式显式快速失败导入：

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=noviqwiki \
PGDATABASE=noviqwiki \
PGSSLMODE=require \
psql -X -v ON_ERROR_STOP=1 --single-transaction -f backups/noviqwiki.sql
```

媒体归档会在数据库恢复前验证，并解压到私有暂存目录。旧媒体树会保留到提升完成；SQL 恢复失败时会恢复旧媒体。Compose 在命名卷中执行相同的暂存提升，并自动停止/重启应用。非 Compose 本地媒体恢复必须设置 `NOVIQWIKI_RESTORE_QUIESCED=true`，且媒体根目录会在提升前再次与确认值核对。

结构标记只能防止意外使用错误格式或截断输入，不能验证 SQL 真伪，也不会把 SQL 沙箱化。被修改的文件仍可包含任意 SQL 或 `psql` 元命令。只能恢复来自可信恢复源、且已核对记录的校验和或签名与来源信息的转储。

### 手动恢复：自定义格式

自定义 `.dump` 文件应使用 `pg_restore`，而不是 `pnpm restore`：

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=noviqwiki \
PGDATABASE=noviqwiki \
PGSSLMODE=require \
pg_restore --clean --if-exists --no-owner --no-acl backups/noviqwiki.dump
```

仅在目标可丢弃或确定要被替换时使用 `--clean --if-exists`。对于全新的空数据库，省略 `--clean` 可以降低误删风险。检查 `pg_restore` 的输出，任何 SQL 错误都应视为恢复失败。

### 媒体恢复

兼容 S3 的存储可使用：

```bash
aws s3 sync backups/media/noviqwiki-assets s3://noviqwiki-assets
```

请加入提供商要求的端点和身份验证参数。除非恢复方案明确要求目的地完全一致，且已经独立核对目标存储桶，否则不要使用 `--delete`。

若在项目脚本之外恢复本地媒体，请将文件解压到配置的持久化 `NOVIQWIKI_MEDIA_ROOT`，并恢复应用用户所需的正确所有权和权限。

### 恢复验证

先检查存活和就绪状态：

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

然后在应用中验证以下全部项目：

若恢复后的数据库包含站点但没有活跃 Owner，NoviqWiki 会有意开放 `/setup` 的 Owner 恢复/引导模式。公开注册仍被阻断，但首个设置访客可以恢复 Owner 角色。在获授权操作人员完成恢复前，应将服务置于可信或受访问限制的网络中。现有用户、页面、媒体和站点设置都会保留；开放正常流量前应确认 `/setup` 已关闭。

- 管理员可以登录和退出。
- 公共页面可以渲染，受限页面仍无法被未授权用户访问。
- 编辑页面会创建新的不可变修订；历史、比较和回滚控件可正常加载。
- 搜索能够返回恢复内容。仅当目标版本要求重建派生搜索数据时运行 `pnpm search:reindex`。
- 代表性的本地或 S3 媒体能够通过 NoviqWiki 加载；启用上传时，新上传也应成功。
- 邮件投递、提供商功能、审计视图以及配置的基础 URL 均符合预期。

将关键行数和媒体清单与原恢复点进行比较。记录备份时间、恢复时间、应用版本、命令、操作人员、验证结果和任何已知的数据丢失窗口。

### 加密、访问与保留

备份在静态和传输过程中都应加密。只允许有权访问生产数据的操作人员访问，并将加密密钥与备份对象分开保存。

保留策略示例：

- 每日备份保留 14 天。
- 每周备份保留 8 周。
- 每月备份保留 12 个月。

请根据法律、隐私、合规、存储和产品要求调整保留时间，并同时测试删除、法律保留和恢复流程。

### 灾难恢复说明

在仓库之外保留一份停机期间仍可访问的恢复运行手册。将提供商恢复步骤、联系路径、凭据和加密密钥恢复信息保存在组织批准的密钥与事件系统中。只有成功完成代表性恢复演练的备份才可视为可靠。
