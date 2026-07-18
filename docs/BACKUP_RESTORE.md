# NoviqWiki Backup and Restore

> [English](BACKUP_RESTORE.md) | [简体中文](BACKUP_RESTORE.md#简体中文)

NoviqWiki stores authoritative application data in PostgreSQL. Uploaded media is stored either on the local filesystem or in S3-compatible object storage. A recoverable backup must cover the database, the active media backend, and the deployment information needed to run the matching application version.

## Safety and Prerequisites

- Run backup and restore commands from the repository host with the target environment variables exported. The TypeScript scripts load `.env` through `dotenv/config`; they do not automatically load `.env.local`. See [CONFIGURATION.md](./CONFIGURATION.md#environment-files).
- The scripts strictly parse the resolved `DATABASE_URL` before invoking database tools: it must use `postgres://` or `postgresql://`, include one host, and identify exactly one database. Target- or credential-overriding query parameters are rejected, an omitted port is normalized to `5432`, and ambient libpq host/address/port/database/service variables are removed from the child process. A URL password is removed from process arguments and supplied through a temporary `0600` passfile. The scripts first try the host's `pg_dump` or `psql`. Only when that executable is unavailable (`ENOENT`) **and** `NOVIQWIKI_COMPOSE_FALLBACK=1` is set do they use Docker context `default`, Compose project `noviqwiki`, service `db`, database `noviqwiki`, and user `noviqwiki`, anchored to this repository's absolute `compose.yaml`. Credential, connectivity, SQL, and other non-zero failures stop immediately. The opt-in Compose path ignores `DATABASE_URL`; enable it only after verifying that fixed target. Local-media backup and restore also require `tar`.
- The runtime image does not install PostgreSQL client tools or the Docker CLI. Do not assume that `docker compose exec app pnpm backup` or `docker compose exec app pnpm restore` will work.
- A restore is destructive. Resolve and verify the exact database URL, SQL file, media archive, bucket, and application version before starting.
- Stop application writes, or place the site in a maintenance window, while taking a consistency-sensitive backup or performing a restore.

## Backup Scope

Back up all of the following:

- PostgreSQL, including the Drizzle migration journal.
- Uploaded media from the configured local directory or S3-compatible bucket.
- The deployment environment and secret references needed to recreate the service. Store secret values only in an approved encrypted secret system. If Compose generated `NOVIQWIKI_SECRET` in the `noviqwiki-secrets` volume, migrate it into that system or protect it separately; `pnpm backup` does not include this volume.
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

`NOVIQWIKI_BACKUP_DIR` defaults to `backups`. The command uses a restrictive process umask: a newly created backup directory has mode `0700`, and generated backup files have mode `0600`. An existing custom output directory keeps its current mode, so protect it with `0700` or stricter permissions before use. The command creates:

- `backups/noviqwiki-<timestamp>-<run-id>.sql`: a plain-text SQL dump produced by `pg_dump`.
- `backups/noviqwiki-<timestamp>-<run-id>-media.tar.gz`: a local-media archive, only when `NOVIQWIKI_MEDIA_DRIVER=local`.

`pnpm backup` accepts only `local` or `s3` as `NOVIQWIKI_MEDIA_DRIVER`. With the local driver, `NOVIQWIKI_MEDIA_ROOT` must already be a readable and searchable dedicated media directory. The script does not create a missing source, and it rejects unsafe broad locations such as the filesystem root, repository root, user home, or another shallow top-level path. It resolves `NOVIQWIKI_BACKUP_DIR` to its real path and rejects an output directory equal to or inside the media root, preventing the archive from including its own backup output. It does **not** create a custom-format PostgreSQL dump, copy S3 objects, export environment variables, include the Compose `noviqwiki-secrets` volume, or encrypt its output.

The command first runs the host's `pg_dump`. Each run receives a UUID suffix so concurrent invocations do not share output names. If the executable is unavailable, the command stops unless `NOVIQWIKI_COMPOSE_FALLBACK=1` explicitly authorizes the fixed default Compose target described above. The opt-in path ignores `DATABASE_URL`; a customized target still requires a working host client or the manual procedure. The generated SQL is then checked for the NoviqWiki plain-dump markers used by restore, and a local-media archive is relisted through the same safe-member checks used by restore. A failed or unrecognized database dump removes the current partial `.sql` file. If local-media archiving or validation fails, the script removes both outputs so the run cannot leave an apparently complete recovery point. For production or a customized deployment, verify the source identity, output modes, sizes, and representative row counts.

Record both generated filenames together. A database backup without its matching media backup is not a complete recovery point.

## Manual PostgreSQL Backup

For a portable compressed custom-format dump:

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="backups/noviqwiki-$(date +%Y%m%d%H%M%S).dump"
```

For a database reachable only through the default Compose service:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U noviqwiki -d noviqwiki --format=custom --no-owner --no-acl > backups/noviqwiki.dump
```

For large databases, run the dump close to PostgreSQL, monitor its duration and size, and use the database provider's snapshot or point-in-time-recovery features as an additional layer.

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

## Project Restore Command: Plain SQL

The bare command `pnpm restore` is not sufficient. The script requires the SQL path and a confirmation bound to the resolved database target. For the default host URL, the value is `restore:localhost:5432/noviqwiki`:

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql \
NOVIQWIKI_RESTORE_CONFIRM=restore:localhost:5432/noviqwiki \
pnpm restore
```

To restore the paired local-media archive as well:

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql \
NOVIQWIKI_RESTORE_MEDIA=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038-media.tar.gz \
NOVIQWIKI_RESTORE_CONFIRM=restore:localhost:5432/noviqwiki \
pnpm restore
```

Before accepting the confirmation or resetting any schema, the script performs all of these checks:

- `DATABASE_URL` must pass the strict PostgreSQL target parsing described above, and `NOVIQWIKI_MEDIA_DRIVER` must be `local` or `s3`.
- `NOVIQWIKI_RESTORE_SQL` must be a readable, non-empty regular file recognized as a complete NoviqWiki plain-text `pg_dump`. The check requires the PostgreSQL dump header, the expected `sites` and `users` table definitions, and the dump-completion marker; a truncated dump, custom `.dump` file, or arbitrary SQL is rejected.
- If `NOVIQWIKI_RESTORE_MEDIA` is set, the media driver must be `local` and the archive must be a readable regular file with at least one member. The tar preflight rejects absolute paths, parent-directory traversal, backslash or control-character paths, and every member type other than regular files and directories, including symbolic and hard links.
- A successful host `psql --version` probe selects the parsed `DATABASE_URL` target. Only an unavailable executable plus the explicit Compose opt-in selects the anchored `compose:default/noviqwiki/db/noviqwiki` target; any other probe failure stops. The selected target determines the confirmation label.

Only after the complete preflight passes must `NOVIQWIKI_RESTORE_CONFIRM` equal `restore:<host>:<port>/<database>` derived from `DATABASE_URL`; an omitted URL port is represented as `5432`. When the opted-in Compose path is selected, the required value is exactly `restore:compose:default/noviqwiki/db/noviqwiki`; a host-target confirmation does not authorize the Compose target. A missing or mismatched value exits before the reset and import.

After confirmation but still before the database reset, the script creates or resolves `NOVIQWIKI_MEDIA_ROOT` only when a media archive was supplied, rejecting the same unsafe broad destinations used by the backup check. It opens the SQL file and verifies that its device, inode, size, and timestamps still match the preflight result. It then runs:

```sql
drop schema if exists public cascade;
drop schema if exists drizzle cascade;
create schema public;
```

This erases the target database's application schema. The script passes the reset SQL and plain-dump input to the same host or Compose `psql` invocation with `-X`, `ON_ERROR_STOP=1`, and `--single-transaction`. Credential, connectivity, reset, and SQL failures stop without switching targets, and an import failure rolls back the schema reset instead of leaving an empty database.

The Compose path is never automatic: an unavailable host `psql` and `NOVIQWIKI_COMPOSE_FALLBACK=1` are both required, and its target-bound confirmation must still match `restore:compose:default/noviqwiki/db/noviqwiki`. The command clears Compose project/file and Docker host/context environment overrides, then explicitly selects the identities encoded in that label. Install `psql` for every customized target. For a separately provisioned empty production target, an explicit fail-fast import is:

```bash
psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql
```

After a successful database import, the script rechecks the media archive's file identity and repeats the tar safety preflight before extracting it into the preflighted writable `NOVIQWIKI_MEDIA_ROOT`. Extraction does not first remove unrelated existing files. PostgreSQL and filesystem media cannot share one transaction: a later permission, capacity, or extraction failure can leave the database restored while media is missing or partially merged. Keep writes stopped, preserve the archive, correct the storage failure, and rerun or complete media recovery before accepting the restore.

The structural dump markers prevent an accidental wrong-format or truncated input; they do not authenticate or sandbox SQL. A modified file can still contain arbitrary SQL or `psql` meta-commands. Restore only a dump from a trusted recovery source after verifying its recorded checksum or signature and expected provenance.

## Manual Restore: Custom Format

Restore a custom `.dump` file with `pg_restore`, not with `pnpm restore`:

```bash
pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/noviqwiki.dump
```

Use `--clean --if-exists` only for a disposable target or one that is intentionally being replaced. For a clean empty database, omitting `--clean` reduces accidental deletion risk. Review `pg_restore` output and treat any SQL error as a failed restore.

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

If the restored database contains a site but zero users, NoviqWiki intentionally exposes `/setup` in Owner-only bootstrap mode. Public registration remains blocked, but the first setup visitor can still claim Owner. Keep the recovered service on a trusted or access-restricted network until an authorized operator creates that account. This step preserves existing pages, media, and site settings; confirm that `/setup` closes after bootstrap before exposing normal traffic.

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
- 脚本会在调用数据库工具前严格解析最终的 `DATABASE_URL`：它必须使用 `postgres://` 或 `postgresql://`，包含单一主机，并且只标识一个数据库。会拒绝覆盖目标或凭据的查询参数，把省略的端口规范为 `5432`，并从子进程环境中移除 libpq 的主机、地址、端口、数据库和服务变量。URL 密码不会出现在进程参数中，而是通过临时 `0600` passfile 提供。脚本会先尝试主机上的 `pg_dump` 或 `psql`。只有相应的可执行文件不可用（`ENOENT`）**且**设置了 `NOVIQWIKI_COMPOSE_FALLBACK=1` 时，才会使用绑定到本仓库绝对 `compose.yaml` 的 Docker `default` context、Compose `noviqwiki` 项目、`db` 服务、`noviqwiki` 数据库和 `noviqwiki` 用户。凭据、连接、SQL 及其他非零失败会立即停止。显式启用的 Compose 路径会忽略 `DATABASE_URL`；只有在确认该固定目标后才能启用。本地媒体备份和恢复还需要 `tar`。
- 运行时镜像没有安装 PostgreSQL 客户端工具或 Docker CLI。不要假定 `docker compose exec app pnpm backup` 或 `docker compose exec app pnpm restore` 可以正常工作。
- 恢复属于破坏性操作。开始前必须确认准确的数据库 URL、SQL 文件、媒体归档、存储桶和应用版本。
- 对一致性有要求的备份或任何恢复操作期间，应停止应用写入或进入维护窗口。

### 备份范围

请备份以下全部内容：

- PostgreSQL 数据库，包括 Drizzle 迁移日志。
- 配置的本地目录或兼容 S3 的存储桶中的上传媒体。
- 重建服务所需的部署环境和密钥引用。密钥值只能保存在获批的加密密钥系统中。若 Compose 已在 `noviqwiki-secrets` 卷中生成 `NOVIQWIKI_SECRET`，应将其迁移到该系统或单独保护；`pnpm backup` 不包含此卷。
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

`NOVIQWIKI_BACKUP_DIR` 默认为 `backups`。该命令会使用受限的进程 umask：新建备份目录的权限为 `0700`，生成的备份文件权限为 `0600`。已存在的自定义输出目录会保留当前权限，因此使用前应将其保护为 `0700` 或更严格。该命令会创建：

- `backups/noviqwiki-<timestamp>-<run-id>.sql`：由 `pg_dump` 生成的纯文本 SQL 转储。
- `backups/noviqwiki-<timestamp>-<run-id>-media.tar.gz`：仅在 `NOVIQWIKI_MEDIA_DRIVER=local` 时生成的本地媒体归档。

`pnpm backup` 只接受 `local` 或 `s3` 作为 `NOVIQWIKI_MEDIA_DRIVER`。使用本地驱动时，`NOVIQWIKI_MEDIA_ROOT` 必须已经是可读、可遍历的专用媒体目录。脚本不会创建缺失的来源，并会拒绝文件系统根目录、仓库根目录、用户主目录或其他浅层顶级路径等不安全的宽泛位置。脚本会将 `NOVIQWIKI_BACKUP_DIR` 解析为真实路径，并拒绝等于媒体根目录或位于其内部的输出目录，以防归档把自身备份产物包含进去。它**不会**生成 PostgreSQL 自定义格式转储，不会复制 S3 对象，不会导出环境变量，不会包含 Compose 的 `noviqwiki-secrets` 卷，也不会加密输出。

该命令会先运行主机上的 `pg_dump`。每次运行都有 UUID 后缀，因此并发调用不会共享输出文件名。若该可执行文件不可用，命令会直接停止，除非通过 `NOVIQWIKI_COMPOSE_FALLBACK=1` 明确授权上文所述的固定默认 Compose 目标。显式启用的路径会忽略 `DATABASE_URL`；自定义目标仍需要可用的主机客户端或手动流程。生成的 SQL 随后会按恢复流程使用的 NoviqWiki 纯转储标记进行检查，本地媒体归档也会按恢复流程的安全成员规则重新列出。数据库转储失败或无法识别时，会删除本次不完整的 `.sql` 文件。若本地媒体归档或校验失败，脚本会同时删除本次两个产物，避免留下看似完整的恢复点。生产或自定义部署还应验证来源标识、输出权限、大小和代表性行数。

应将两个生成文件名作为同一个恢复点记录。只有数据库而没有对应媒体的备份并不完整。

### 手动备份 PostgreSQL

若需可移植的压缩自定义格式转储：

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file="backups/noviqwiki-$(date +%Y%m%d%H%M%S).dump"
```

若数据库只能通过默认 Compose 服务访问：

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U noviqwiki -d noviqwiki --format=custom --no-owner --no-acl > backups/noviqwiki.dump
```

大型数据库应尽量在靠近 PostgreSQL 的基础设施中执行转储，并监控耗时和文件大小；同时使用数据库提供商的快照或时间点恢复能力作为额外保障。

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

仅运行 `pnpm restore` 不足以完成恢复。脚本必须获得 SQL 路径，以及与最终数据库目标绑定的确认值。默认主机 URL 对应的值为 `restore:localhost:5432/noviqwiki`：

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql \
NOVIQWIKI_RESTORE_CONFIRM=restore:localhost:5432/noviqwiki \
pnpm restore
```

如需同时恢复配套的本地媒体归档：

```bash
NOVIQWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql \
NOVIQWIKI_RESTORE_MEDIA=backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038-media.tar.gz \
NOVIQWIKI_RESTORE_CONFIRM=restore:localhost:5432/noviqwiki \
pnpm restore
```

接受确认值或重置任何 Schema 前，脚本会完成以下全部检查：

- `DATABASE_URL` 必须通过上文所述的严格 PostgreSQL 目标解析，且 `NOVIQWIKI_MEDIA_DRIVER` 必须为 `local` 或 `s3`。
- `NOVIQWIKI_RESTORE_SQL` 必须是可读、非空的普通文件，并被识别为完整的 NoviqWiki 纯文本 `pg_dump`。检查要求存在 PostgreSQL 转储头、预期的 `sites` 和 `users` 表定义以及转储完成标记；截断转储、自定义 `.dump` 文件和任意 SQL 都会被拒绝。
- 若设置了 `NOVIQWIKI_RESTORE_MEDIA`，媒体驱动必须为 `local`，归档必须是至少包含一个成员的可读普通文件。tar 预检会拒绝绝对路径、父目录穿越、反斜杠或控制字符路径，以及除普通文件和目录之外的所有成员类型，包括符号链接和硬链接。
- 主机 `psql --version` 探测成功时会选择解析后的 `DATABASE_URL` 目标。只有可执行文件不可用且已显式启用 Compose 时，才会选择锚定的 `compose:default/noviqwiki/db/noviqwiki` 目标；任何其他探测失败都会停止。所选目标决定确认标签。

只有完整预检通过后，`NOVIQWIKI_RESTORE_CONFIRM` 才必须等于根据 `DATABASE_URL` 得出的 `restore:<host>:<port>/<database>`；URL 省略端口时会显示 `5432`。选择显式启用的 Compose 路径时，所需值严格为 `restore:compose:default/noviqwiki/db/noviqwiki`；主机目标确认不能授权 Compose 目标。缺少确认值或值不匹配时，脚本会在重置和导入前退出。

完成确认后但仍在重置数据库前，脚本只会在已提供媒体归档时创建或解析 `NOVIQWIKI_MEDIA_ROOT`，并拒绝与备份检查相同的不安全宽泛目的地。脚本会打开 SQL 文件，确认其设备、inode、大小和时间戳仍与预检结果一致。然后执行：

```sql
drop schema if exists public cascade;
drop schema if exists drizzle cascade;
create schema public;
```

这会清除目标数据库中的应用架构。脚本会把重置 SQL 和纯转储输入传给同一个主机或 Compose `psql` 调用，并使用 `-X`、`ON_ERROR_STOP=1` 和 `--single-transaction`。凭据、连接、重置和 SQL 失败都会停止，且不会切换目标；导入失败会回滚 Schema 重置，而不会留下空数据库。

Compose 路径绝不会自动启用：必须同时满足主机 `psql` 不可用和 `NOVIQWIKI_COMPOSE_FALLBACK=1`，并且目标绑定确认仍须匹配 `restore:compose:default/noviqwiki/db/noviqwiki`。命令会清除 Compose 项目/文件以及 Docker 主机/context 环境覆盖，然后显式选择该标签编码的身份。所有自定义目标都应安装 `psql`。对于单独创建的空生产目标，可按以下方式显式快速失败导入：

```bash
psql -X "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f backups/noviqwiki-2026-07-17T12-00-00-000Z-87bdf3d0-6c8b-4a09-ae26-e2d2b28b8038.sql
```

数据库导入成功后，脚本会重新检查媒体归档的文件身份并再次执行 tar 安全预检，然后才将其解压到已预检为可写的 `NOVIQWIKI_MEDIA_ROOT`。解压前不会删除目录中其他无关文件。PostgreSQL 与文件系统媒体无法共享一个事务：后续权限、容量或解压失败可能使数据库已经恢复，而媒体缺失或只合并了一部分。此时应继续停止写入、保留归档、修复存储问题，并在接受恢复结果前重跑或完成媒体恢复。

结构标记只能防止意外使用错误格式或截断输入，不能验证 SQL 真伪，也不会把 SQL 沙箱化。被修改的文件仍可包含任意 SQL 或 `psql` 元命令。只能恢复来自可信恢复源、且已核对记录的校验和或签名与来源信息的转储。

### 手动恢复：自定义格式

自定义 `.dump` 文件应使用 `pg_restore`，而不是 `pnpm restore`：

```bash
pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/noviqwiki.dump
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

若恢复后的数据库包含站点但用户数为零，NoviqWiki 会有意开放 `/setup` 的仅所有者 bootstrap 模式。公开注册会保持阻断，但第一个设置访客仍可取得 Owner。在获授权操作人员创建该账户前，应将恢复服务置于可信或受访问限制的网络中。该步骤会保留现有页面、媒体和站点设置；开放正常流量前，应确认 bootstrap 完成后 `/setup` 已关闭。

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
