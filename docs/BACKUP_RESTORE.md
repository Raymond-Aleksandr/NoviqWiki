# NoviqWiki Backup and Restore

> [English](BACKUP_RESTORE.md) | [简体中文](BACKUP_RESTORE.md#简体中文)

NoviqWiki stores authoritative application data in PostgreSQL. Uploaded media is stored either on the local filesystem or in S3-compatible object storage. A recoverable backup must cover the database, the active media backend, and the deployment information needed to run the matching application version.

## Safety and Prerequisites

- Run backup and restore commands from the repository host with the target environment variables exported. The TypeScript scripts load `.env` through `dotenv/config`; they do not automatically load `.env.local`. See [CONFIGURATION.md](./CONFIGURATION.md#environment-files).
- The application backup script needs `pg_dump` on the host. Any non-zero host `pg_dump` result—not only a missing executable—triggers a fallback to this repository's default Compose database. This can select the wrong source after a credential or connectivity error. Use the manual command for production or any customized deployment. The script also needs `tar` when local media is enabled.
- The runtime image does not install PostgreSQL client tools or the Docker CLI. Do not assume that `docker compose exec app pnpm backup` or `docker compose exec app pnpm restore` will work.
- A restore is destructive. Resolve and verify the exact database URL, SQL file, media archive, bucket, and application version before starting.
- Stop application writes, or place the site in a maintenance window, while taking a consistency-sensitive backup or performing a restore.

## Backup Scope

Back up all of the following:

- PostgreSQL, including the Drizzle migration journal.
- Uploaded media from the configured local directory or S3-compatible bucket.
- The deployment environment and secret references needed to recreate the service. Store secret values only in an approved encrypted secret system.
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
NEXTWIKI_BACKUP_DIR=backups pnpm backup
```

`NEXTWIKI_BACKUP_DIR` defaults to `backups`. The command creates:

- `backups/noviqwiki-<timestamp>.sql`: a plain-text SQL dump produced by `pg_dump`.
- `backups/noviqwiki-<timestamp>-media.tar.gz`: a local-media archive, only when `NEXTWIKI_MEDIA_DRIVER=local`.

The command does **not** create a custom-format PostgreSQL dump, copy S3 objects, export environment variables, or encrypt its output. Any non-zero `pg_dump` result triggers a fallback specific to this repository's default Compose service, database, and user (`db`, `nextwiki`, and `nextwiki`). A bad `DATABASE_URL` can therefore produce a dump of the default Compose database instead of failing closed. For production or a customized deployment, use the manual procedure and verify the source identity, output size, and representative row counts.

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
docker compose exec -T db pg_dump -U nextwiki -d nextwiki --format=custom --no-owner --no-acl > backups/noviqwiki.dump
```

For large databases, run the dump close to PostgreSQL, monitor its duration and size, and use the database provider's snapshot or point-in-time-recovery features as an additional layer.

## Media Backup

For local media, archive the exact directory configured by `NEXTWIKI_MEDIA_ROOT`. The project backup command does this automatically when the local driver is active.

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

The bare command `pnpm restore` is not sufficient. The script requires the SQL path and a literal destructive-operation confirmation:

```bash
NEXTWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z.sql \
NEXTWIKI_RESTORE_CONFIRM=restore \
pnpm restore
```

To restore the paired local-media archive as well:

```bash
NEXTWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z.sql \
NEXTWIKI_RESTORE_MEDIA=backups/noviqwiki-2026-07-17T12-00-00-000Z-media.tar.gz \
NEXTWIKI_RESTORE_CONFIRM=restore \
pnpm restore
```

Before importing the SQL, the script runs:

```sql
drop schema if exists public cascade;
drop schema if exists drizzle cascade;
create schema public;
```

This erases the target database's application schema. The media archive is extracted into `NEXTWIKI_MEDIA_ROOT` only when `NEXTWIKI_MEDIA_DRIVER=local`; extraction does not first remove unrelated existing files. The project restore command accepts the plain `.sql` output from `pnpm backup`, not a custom `.dump` file.

Any failure of the host-side schema reset triggers the fallback path tied to the default Compose service, database, and user, so a bad target URL can redirect this destructive operation to the wrong database. In addition, the project script does not pass `ON_ERROR_STOP` to `psql`; individual SQL errors may not produce a failing process status. Use this command only for the verified default evaluation stack and inspect all output. For production or customized deployments, provision a separate empty target and run plain SQL explicitly with fail-fast behavior:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backups/noviqwiki-2026-07-17T12-00-00-000Z.sql
```

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

For local media restored outside the project script, extract into the configured persistent `NEXTWIKI_MEDIA_ROOT`, then restore the correct ownership and permissions for the application user.

## Restore Validation

First verify liveness and readiness:

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

Then validate all of the following in the application:

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
- 应用备份脚本需要主机安装 `pg_dump`。主机 `pg_dump` 的任何非零结果（不仅是缺少可执行文件）都会触发回退到本仓库默认 Compose 数据库；凭据或连接错误可能因此选错备份源。生产或任何自定义部署应使用手动命令。启用本地媒体时还需要 `tar`。
- 运行时镜像没有安装 PostgreSQL 客户端工具或 Docker CLI。不要假定 `docker compose exec app pnpm backup` 或 `docker compose exec app pnpm restore` 可以正常工作。
- 恢复属于破坏性操作。开始前必须确认准确的数据库 URL、SQL 文件、媒体归档、存储桶和应用版本。
- 对一致性有要求的备份或任何恢复操作期间，应停止应用写入或进入维护窗口。

### 备份范围

请备份以下全部内容：

- PostgreSQL 数据库，包括 Drizzle 迁移日志。
- 配置的本地目录或兼容 S3 的存储桶中的上传媒体。
- 重建服务所需的部署环境和密钥引用。密钥值只能保存在获批的加密密钥系统中。
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
NEXTWIKI_BACKUP_DIR=backups pnpm backup
```

`NEXTWIKI_BACKUP_DIR` 默认为 `backups`。该命令会创建：

- `backups/noviqwiki-<timestamp>.sql`：由 `pg_dump` 生成的纯文本 SQL 转储。
- `backups/noviqwiki-<timestamp>-media.tar.gz`：仅在 `NEXTWIKI_MEDIA_DRIVER=local` 时生成的本地媒体归档。

该命令**不会**生成 PostgreSQL 自定义格式转储，不会复制 S3 对象，不会导出环境变量，也不会加密输出。`pg_dump` 的任何非零结果都会触发仅适用于本仓库默认 Compose 服务、数据库和用户（`db`、`nextwiki`、`nextwiki`）的回退。错误的 `DATABASE_URL` 因此可能生成默认 Compose 数据库的转储，而不是安全失败。生产或自定义部署应使用后文手动流程，并验证来源标识、输出大小和代表性行数。

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
docker compose exec -T db pg_dump -U nextwiki -d nextwiki --format=custom --no-owner --no-acl > backups/noviqwiki.dump
```

大型数据库应尽量在靠近 PostgreSQL 的基础设施中执行转储，并监控耗时和文件大小；同时使用数据库提供商的快照或时间点恢复能力作为额外保障。

### 媒体备份

本地媒体必须归档 `NEXTWIKI_MEDIA_ROOT` 配置的准确目录。启用本地驱动时，项目备份命令会自动完成此操作。

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

仅运行 `pnpm restore` 不足以完成恢复。脚本必须获得 SQL 路径以及固定字面值的破坏性操作确认：

```bash
NEXTWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z.sql \
NEXTWIKI_RESTORE_CONFIRM=restore \
pnpm restore
```

如需同时恢复配套的本地媒体归档：

```bash
NEXTWIKI_RESTORE_SQL=backups/noviqwiki-2026-07-17T12-00-00-000Z.sql \
NEXTWIKI_RESTORE_MEDIA=backups/noviqwiki-2026-07-17T12-00-00-000Z-media.tar.gz \
NEXTWIKI_RESTORE_CONFIRM=restore \
pnpm restore
```

导入 SQL 前，脚本会执行：

```sql
drop schema if exists public cascade;
drop schema if exists drizzle cascade;
create schema public;
```

这会清除目标数据库中的应用架构。仅当 `NEXTWIKI_MEDIA_DRIVER=local` 时，媒体归档才会被解压到 `NEXTWIKI_MEDIA_ROOT`；解压前不会删除目录中其他无关文件。项目恢复命令只接受 `pnpm backup` 生成的纯文本 `.sql`，不接受自定义 `.dump` 文件。

主机端 Schema 重置的任何失败都会触发依赖默认 Compose 服务、数据库和用户的回退，因此错误的目标 URL 可能把破坏性操作转向错误数据库。此外，项目脚本没有向 `psql` 传入 `ON_ERROR_STOP`；单条 SQL 错误可能不会产生失败进程状态。该命令只能用于经过核对的默认评估栈，并必须检查全部输出。生产或自定义部署应准备单独的空目标，并以快速失败方式显式导入纯 SQL：

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backups/noviqwiki-2026-07-17T12-00-00-000Z.sql
```

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

若在项目脚本之外恢复本地媒体，请将文件解压到配置的持久化 `NEXTWIKI_MEDIA_ROOT`，并恢复应用用户所需的正确所有权和权限。

### 恢复验证

先检查存活和就绪状态：

```bash
curl -fsS https://wiki.example.com/api/health
curl -fsS https://wiki.example.com/api/ready
```

然后在应用中验证以下全部项目：

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
