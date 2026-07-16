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

The backup command should capture the database and configured media metadata according to the deployment's storage driver. Keep raw database and object-storage procedures documented as a fallback.

## PostgreSQL Backup

Create a compressed custom-format dump:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl --file=backup/noviqwiki-$(date +%Y%m%d%H%M%S).dump
```

For large databases, run backups from infrastructure close to the database and monitor duration.

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
pg_restore --dbname "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backup/noviqwiki.dump
```

Use `--clean --if-exists` only when the target database is disposable or intentionally being replaced. For production recovery, confirm the target before running the command.

## Application Restore Command

Use the project restore command when available:

```bash
pnpm restore
```

Confirm the target environment before running restore commands. Restore operations can overwrite existing data.

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
