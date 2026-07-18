# NoviqWiki Backup and Restore

NoviqWiki stores authoritative application data in PostgreSQL. Uploaded media may be stored in S3-compatible object storage or another configured persistent store. A complete backup includes both.

## Backup Scope

Back up:

- PostgreSQL database.
- Uploaded media.
- Deployment environment values needed to restore service.
- Application version or container image digest.
- Drizzle migration files for the deployed version.

Do not store secrets in the same location as unencrypted backups unless the backup system is explicitly designed for secret storage.

## Backup Frequency

For production, use:

- Daily full database backups.
- Point-in-time recovery where the PostgreSQL provider supports it.
- Daily media inventory or bucket replication.
- A restore drill before every major release and at least monthly.

Adjust frequency for the wiki's recovery point objective.

## Application Backup Command

Use the project backup command when available:

```bash
pnpm backup
```

For the supplied Compose deployment, the command recognizes the exact `db` target, streams
`pg_dump` from the database container, and streams local media from the `nextwiki-media` volume
through a one-off application container. If the application service is running, it is stopped for
the database-plus-local-media snapshot and restarted afterward so writes cannot split the pair.
Both conditions are required: a configured `/app/media` path alone does not select Compose tools
when the database is external. Bare-metal, Kubernetes, and external-database deployments therefore
use the configured path directly and require the explicit quiescence acknowledgement below.

For a non-Compose local-media deployment, stop all application writers first and acknowledge that
state explicitly:

```bash
NEXTWIKI_BACKUP_QUIESCED=true pnpm backup
```

New backup directories are created with mode `0700`; an existing directory must already be mode
`0700` or stricter and is never chmodded by the command. SQL and media files are created exclusively
with mode `0600`. The backup and local-media directories must not overlap, which prevents an archive
from including itself or earlier backups. A failed database or media step removes both partial
outputs. Keep raw database and object-storage procedures documented as a fallback.

For the exact Compose database target, the containerized `pg_dump` output is streamed directly to
disk, so dump size is not constrained by a child-process memory buffer.

## PostgreSQL Backup

Create a compressed custom-format dump:

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=nextwiki \
PGDATABASE=nextwiki \
PGSSLMODE=require \
pg_dump --format=custom --no-owner --no-acl --file=backup/noviqwiki-$(date +%Y%m%d%H%M%S).dump
```

Put the password in a mode-`0600` libpq `.pgpass` file, a `PGPASSFILE` supplied by the deployment
secret store, or an equivalently protected service definition. Do not pass a password-bearing
`DATABASE_URL` as a command argument: command lines may be visible to other local processes. For
large databases, run backups from infrastructure close to the database and monitor duration.

## Media Backup

For S3-compatible storage, use the provider's replication or versioning features. For a manual sync:

```bash
aws s3 sync s3://noviqwiki-assets backup/media/noviqwiki-assets
```

Use the correct endpoint and profile for non-AWS providers.

## Restore Plan

A restore needs a target database, media store, environment configuration, and application version compatible with the restored schema.

High-level order:

1. Stop writes to the damaged environment.
2. Provision a clean PostgreSQL database.
3. Restore the database dump.
4. Restore or repoint uploaded media.
5. Deploy the matching NoviqWiki application version.
6. Run migrations only if restoring into a newer application version intentionally.
7. Smoke test before reopening writes.

## PostgreSQL Restore

Create the target database, then restore:

```bash
PGHOST=database.example.com \
PGPORT=5432 \
PGUSER=nextwiki \
PGDATABASE=nextwiki \
PGSSLMODE=require \
pg_restore --clean --if-exists --no-owner --no-acl backup/noviqwiki.dump
```

Use the same protected `.pgpass`/`PGPASSFILE` approach as backup, and verify every non-secret
target variable before starting. Use `--clean --if-exists` only when the target database is
disposable or intentionally being replaced. For production recovery, confirm the target before
running the command.

## Application Restore Command

Use the project restore command when available:

```bash
NEXTWIKI_RESTORE_SQL=backups/noviqwiki.sql \
NEXTWIKI_RESTORE_MEDIA=backups/noviqwiki-media.tar.gz \
NEXTWIKI_RESTORE_CONFIRM='restore:nextwiki@db:5432/nextwiki:media=%2Fapp%2Fmedia' \
pnpm restore
```

The confirmation is derived from the parsed database username, host, port, and database name; the
command prints the exact required value when it is absent or wrong. When
`NEXTWIKI_RESTORE_MEDIA` is set, confirmation also includes the percent-encoded canonical absolute
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
stop application writes and add `NEXTWIKI_RESTORE_QUIESCED=true`. `NEXTWIKI_MEDIA_ROOT` must resolve
to a dedicated directory; filesystem roots, home/workspace ancestors, linked trees, and non-regular
files are rejected.
The exact canonical absolute root is bound into `NEXTWIKI_RESTORE_CONFIRM` and is checked again
immediately before promotion. This explicit binding is the destructive-operation boundary; broad
but otherwise valid paths such as a directory below the home or workspace are never authorized by
the database-only confirmation. Confirm the target environment before running restore commands; a
successful restore intentionally replaces existing data.

Database tooling is selected by the validated target, not by whether a host binary happens to be
installed. The exact Compose `db` target always uses container tools; every other target requires
local PostgreSQL client tools. A failing local command is never silently replaced with a dump from
another database. Target-changing URL query parameters are rejected, and non-Compose client
commands remove the database password from their process arguments.

## Media Restore

For S3-compatible storage:

```bash
aws s3 sync backup/media/noviqwiki-assets s3://noviqwiki-assets
```

After restore, verify that representative uploaded media and attachments load through the application, not just from the bucket.

## Restore Validation

Validate:

- Login works for an administrator.
- Public page reads work.
- Restricted page access is enforced.
- Page edit creates a new immutable revision.
- Revision history renders.
- Search returns restored content.
- Uploaded media loads.
- New media uploads work if enabled.

Document the backup timestamp, restore timestamp, commands used, operator, and any data loss window.

## Encryption and Retention

Encrypt backups at rest. Limit access to operators who can also access production data.

Recommended baseline:

- Daily backups retained for 14 days.
- Weekly backups retained for 8 weeks.
- Monthly backups retained for 12 months.

Confirm retention against legal, compliance, and product requirements before production launch.

## Disaster Recovery Notes

Keep restore documentation outside the application repository as well, so operators can access it during an outage. Store credentials and provider recovery steps in the organization's approved secret and incident systems.
