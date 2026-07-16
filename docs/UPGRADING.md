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

Validate configuration:

```bash
docker compose config
```

Build or pull the target application image:

```bash
docker compose build
```

Back up data, then apply migrations once:

```bash
pnpm db:migrate
```

Update services:

```bash
docker compose up -d
```

Check logs:

```bash
docker compose logs --tail=200 app
```

Use the actual service name from `docker compose config --services` if it differs from `app`.

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
