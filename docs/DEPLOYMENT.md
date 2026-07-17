# NoviqWiki Deployment

This guide describes a production deployment for NoviqWiki v0.1.0 using Next.js, PostgreSQL, Drizzle, Docker Compose, and pnpm.

## Production Requirements

- A supported Node.js runtime for the deployed Next.js version.
- PostgreSQL 16 or newer.
- Persistent object storage for uploaded media when uploads are enabled.
- HTTPS termination through a reverse proxy, load balancer, or platform ingress.
- A secret manager or equivalent deployment-managed environment variables.
- Regular database and media backups.

## Build Locally Before Release

Run the full verification gate before building a release artifact:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:e2e
docker compose config
docker compose build
```

Record the command output in the release notes only after running it for the release candidate.

## Environment

At minimum, production needs:

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret
NEXTWIKI_MEDIA_DRIVER=s3
```

Configure SMTP and S3-compatible storage when those features are enabled. See [CONFIGURATION.md](./CONFIGURATION.md).

## Database Migrations

Migrations are part of deployment. Apply them once per release before or during application rollout:

```bash
pnpm db:migrate
```

For production:

- Back up the database first.
- Review generated SQL before applying it.
- Run migrations from a single release job, not every app instance.
- Keep the previous container image available until post-deploy checks pass.

## Docker Compose Deployment

Validate the Compose file:

```bash
docker compose config
```

Build images:

```bash
docker compose build
```

Start or update services:

```bash
docker compose up -d
```

Inspect runtime status:

```bash
docker compose ps
docker compose logs --tail=200 app
```

Use the actual service name from `docker compose config --services` if it differs from `app`.

## Reverse Proxy

Terminate TLS before traffic reaches the Next.js app. Forward these headers from the proxy:

- `Host`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-For`

Set `NEXTWIKI_BASE_URL` to the externally visible HTTPS URL. Production cookies must be secure.

## Health Checks

At minimum, verify the application can serve `GET /` and connect to the database after deployment. Use the v0.1.0 health and readiness endpoints for load balancer checks when enabled:

```text
GET /api/health
GET /api/ready
```

Example manual check:

```bash
curl -fsS https://wiki.example.com/
```

## Static Assets and Media

Application static assets are built by Next.js. User media must be stored outside the container filesystem unless the deployment uses a persistent mounted volume.

For S3-compatible storage:

- Use a private bucket.
- Scope credentials to the bucket.
- Enable bucket versioning where available.
- Include the bucket in backup and restore drills.

## Observability

Production logs should be structured and shipped to the platform log system. Track:

- Application start and shutdown.
- Migration start and completion.
- Authentication failures.
- Privileged admin actions.
- Media upload failures.
- Unhandled server errors.

Logs must not include secrets, raw cookies, password reset tokens, or full content bodies.

## Rollback

Rollback requires both application and database planning:

1. Keep the previous application image available.
2. Review whether migrations are backward compatible.
3. If a migration is not backward compatible, restore from the pre-deploy backup or run a reviewed down migration if one exists.
4. Repoint traffic to the previous image.
5. Run smoke checks against setup status, login, page read, page edit, search, and media uploads if enabled.

Never roll back the application across a non-reversible schema change without a data plan.
