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
NEXTWIKI_SETUP_TOKEN=replace-with-separate-one-time-token
NEXTWIKI_MEDIA_DRIVER=s3
```

Configure SMTP and S3-compatible storage when those features are enabled. Enter `NEXTWIKI_SETUP_TOKEN` during the initial Owner setup, then remove it from the deployment environment. See [CONFIGURATION.md](./CONFIGURATION.md).

For the supplied Compose file, also set a unique raw `POSTGRES_PASSWORD` and set the required
`DATABASE_URL` to a complete URL whose host is `db`. Compose does not interpolate the password into
the URL. Percent-encode any reserved characters in the URL credentials while keeping
`POSTGRES_PASSWORD` raw. PostgreSQL is reachable only on the private Compose network; do not
publish its port in an internet-facing deployment.

## Database Migrations

Migrations are part of deployment. Apply them once per release before or during application rollout:

```bash
pnpm db:migrate
```

The host command is for environments where `DATABASE_URL` is reachable from the host. The supplied
Compose database is private; run the release migration through the app image instead:

```bash
docker compose up -d db
docker compose run --rm --no-deps app node scripts/migrate.mjs
```

The supplied image also runs this migration runner before starting the server. It uses a PostgreSQL
advisory lock, so concurrent container starts serialize migration work and already-applied releases
are a no-op.

For production:

- Back up the database first.
- Review generated SQL before applying it.
- Prefer a single release job where the deployment platform supports one.
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

Keep `NEXTWIKI_SECRET` stable across restarts and replicas. On a fresh installation, remove the
one-time `NEXTWIKI_SETUP_TOKEN` after the first Owner has completed setup.

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

Set `NEXTWIKI_BASE_URL` to the externally visible HTTPS URL. It is the production-authoritative
origin for request validation, redirects, email links, and citations even if the database contains
an older Base URL from setup. Production cookies must be secure.

The supplied Compose port binds to `127.0.0.1:3000` so a host reverse proxy can reach it without
publishing the application directly. If the proxy is another Compose service, remove the host port
mapping and route to `app:3000` over the private service network.

`X-Forwarded-For` is ignored for source-based authentication rate limits unless `NEXTWIKI_TRUSTED_PROXY_HOPS` is configured. Set it to the fixed number of trusted proxies between the client and NoviqWiki (for example, `1` for one proxy). Only enable it when firewall or network policy prevents direct access to the application port and every trusted proxy overwrites or appends its immediate peer address; otherwise a client can forge its rate-limit identity. Invalid or incomplete IP chains do not enable a source bucket for that request, while account and global limits remain active.

## Health Checks

At minimum, verify the application can serve `GET /` and connect to the database after deployment. Use liveness for process monitoring and readiness for load-balancer routing. Readiness returns HTTP 503 when PostgreSQL or the configured media backend cannot be used:

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
- Grant object read, write, and delete permissions for media keys and the
  `.noviqwiki-readiness/` probe prefix.
- When bucket versioning is enabled, allow deletion of the exact probe version so readiness checks
  do not accumulate object versions or delete markers.
- Enable bucket versioning where available.
- Include the bucket in backup and restore drills.

Successful S3 capability probes are cached for five minutes and failures for 30 seconds. Concurrent
readiness requests share one in-flight probe.

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
