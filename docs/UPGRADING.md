# Upgrading NoviqWiki

This guide covers upgrades between NoviqWiki releases. Treat every upgrade as an application and database change unless the release notes explicitly say otherwise.

## Versioning

NoviqWiki v0.1.0 is an initial release. Until a stable 1.0 contract exists, minor releases may include schema and API changes. Pin deployments to a specific release tag or image digest.

## Before You Upgrade

1. Read the release notes for the target version.
2. Confirm Node.js, pnpm, PostgreSQL, and Docker versions meet the target requirements.
3. Back up PostgreSQL and uploaded media.
4. Confirm you can restore the backup.
5. Review Drizzle migrations included in the release.
6. Run the full verification gate in a staging environment.

## Local Upgrade

Update dependencies and install:

```bash
pnpm install
```

Apply migrations:

```bash
pnpm db:migrate
```

Rebuild derived search data after releases that change rendering or indexing behavior:

```bash
pnpm search:reindex
```

Run verification:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
```

## Docker Compose Upgrade

### Preserve credentials for existing volumes

The supplied Compose file no longer uses the historical `nextwiki` database password or an
ephemeral application signing secret. Before recreating containers, put the credentials for the
existing database volume and a stable application secret in `.env`:

```bash
POSTGRES_USER=nextwiki
POSTGRES_DB=nextwiki
POSTGRES_PASSWORD=current-database-password
DATABASE_URL=postgres://nextwiki:current-database-password@db:5432/nextwiki
NEXTWIKI_SECRET=replace-with-a-stable-32-byte-or-longer-secret
```

`POSTGRES_PASSWORD` contains the raw password used by the database container. `DATABASE_URL` is now
an independent, required Compose setting; it must be a complete URL using the private `db` service
host. Percent-encode reserved characters in the URL username or password (for example, encode `@`
as `%40`) while leaving `POSTGRES_PASSWORD` raw. Compose no longer interpolates the raw password
into the connection URL.

Keep an already configured `NEXTWIKI_SECRET` unchanged. If an older container generated its secret
at startup, generate and persist a new value now; existing sessions will be invalidated once, but
subsequent restarts will keep sessions valid. `NEXTWIKI_SETUP_TOKEN` is needed only for a database
where initial Owner setup has not completed.

PostgreSQL applies `POSTGRES_PASSWORD` only when it initializes an empty data directory. Changing
the variable does not change the password inside an existing named volume. For an untouched volume
created by the older default Compose file, the current password is `nextwiki`. Use that current
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

Compose rejects a missing or empty `DATABASE_URL`, `POSTGRES_PASSWORD`, `NEXTWIKI_BASE_URL`, or
`NEXTWIKI_SECRET`. Set `NEXTWIKI_BASE_URL` to the externally visible canonical origin, including
`https://` in production; it controls generated email links and same-origin validation for writes.

Build or pull the target application image:

```bash
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

Check logs:

```bash
docker compose logs --tail=200 app
```

Use the actual service name from `docker compose config --services` if it differs from `app`.

The default application port is bound to `127.0.0.1:3000`. Keep that loopback binding when a reverse
proxy runs on the host. A proxy running in Compose should reach `app:3000` on the private service
network rather than publishing the application port on every host interface.

Older S3-backed revisions may contain persisted pre-signed object URLs. The upgraded application
maps those URLs to authorized same-origin `/media/...` routes while rendering current or historical
articles, visual revision diffs, editors, homepage covers, and activity links. Canonical revision
API responses keep the stored Markdown, HTML, and matching content hash unchanged; the compatibility
view does not rewrite immutable revision records.

## Post-Upgrade Checks

Validate:

- Home page loads.
- Login and logout work.
- Existing pages render from stored sanitized HTML.
- Editing a page creates a new immutable revision.
- Revision diff/history loads.
- Search returns existing and newly edited content.
- Media loads and new uploads work if enabled.
- Admin-only pages reject users without the required role or permission.

Do not mark the upgrade complete until these checks pass in the target environment.

## Rollback

Rollback depends on migration compatibility.

If no database migration was applied, redeploy the previous application image.

If backward-compatible migrations were applied, redeploy the previous image only after confirming the old code tolerates the new schema.

If destructive or incompatible migrations were applied, restore the pre-upgrade database and media, then redeploy the previous image.

## Data Migrations

Data migrations must be:

- Idempotent or guarded against repeated execution.
- Tested against a copy of production-sized data.
- Logged with enough detail to audit progress.
- Paired with a rollback or restore plan.

Do not perform long-running data rewrites inside request handlers.

## Dependency Upgrades

For framework and dependency upgrades:

- Keep TypeScript strictness intact.
- Run `pnpm typecheck` after changes.
- Run integration tests for database and authorization behavior.
- Run end-to-end tests for login, editing, search, and media uploads.
- Review sanitizer changes carefully; rendering changes can affect stored HTML and search text.

## API Documentation

If the release changes route contracts, regenerate the OpenAPI description:

```bash
pnpm openapi
```
