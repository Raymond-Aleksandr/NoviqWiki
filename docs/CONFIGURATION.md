# NoviqWiki Configuration

NoviqWiki is configured through environment variables. Keep production secrets out of source control and inject them through the deployment platform, Docker secrets, or a managed secret store.

The v0.1.0 environment variable prefix is `NEXTWIKI_*`. This is a configuration namespace, not a product name change.

## Environment Files

Use `.env.local` for local development:

```bash
cp .env.example .env.local
```

Use deployment-managed environment variables for production. Do not commit files that contain real credentials. Restart the application after configuration changes.

## Required Variables

| Variable               | Example                                       | Description                                                                                                   |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | `postgres://nextwiki:secret@db:5432/nextwiki` | Complete PostgreSQL connection URL used by Drizzle and server-side services. Credentials must be URL-encoded. |
| `NEXTWIKI_BASE_URL`    | `https://wiki.example.com`                    | Production-authoritative canonical HTTP(S) origin used for redirects, citations, and email links.             |
| `NEXTWIKI_SECRET`      | generated 32 byte secret                      | Secret used for session and security-sensitive signing. Must be stable across restarts.                       |
| `NEXTWIKI_SETUP_TOKEN` | generated 32 byte token                       | One-time deployment token required to claim an uninitialized production instance. Remove it after setup.      |
| `NODE_ENV`             | `production`                                  | Runtime mode. Use `development`, `test`, or `production`.                                                     |

Generate `NEXTWIKI_SECRET` with:

```bash
openssl rand -hex 32
```

Generate a separate `NEXTWIKI_SETUP_TOKEN` the same way. Enter it in the initial setup wizard, then remove the variable after setup completes.

Use the Compose service host `db` when the application runs inside Docker Compose. Use `localhost` when running `pnpm dev` directly on the host against a Compose-managed PostgreSQL port.

The supplied Compose file requires `DATABASE_URL` directly and does not construct it from
`POSTGRES_PASSWORD`. Keep the raw database password and the URL password component consistent. If
credentials contain reserved URL characters, percent-encode them only in `DATABASE_URL` (for
example, `@` becomes `%40`).

## Reverse Proxy Trust

| Variable                      | Default   | Description                                                                                                            |
| ----------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_TRUSTED_PROXY_HOPS` | _(unset)_ | Number of trusted reverse-proxy hops in `X-Forwarded-For` (1-16). Leave unset unless every request crosses those hops. |

NoviqWiki ignores `X-Forwarded-For` for source-based authentication rate limits by default because clients can forge that header. Set `NEXTWIKI_TRUSTED_PROXY_HOPS` only when the application port is not directly reachable by untrusted clients and each trusted proxy overwrites or appends the address of its immediate peer. For one trusted proxy, use `1`; for an edge proxy followed by an internal proxy, use `2`. The selected entry must be a valid IPv4 or IPv6 address, otherwise the source bucket is disabled for that request. Account and global authentication limits remain active regardless of this setting.

## Development-Only Variables

| Variable                       | Example                                                    | Description                                                                                                         |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_ALLOWED_DEV_ORIGINS` | `192.168.1.20`                                             | Comma-separated hosts appended to Next.js `allowedDevOrigins` for LAN/mobile checks against `pnpm dev`.             |
| `NEXTWIKI_E2E_DATABASE_URL`    | `postgres://nextwiki:nextwiki@localhost:5432/nextwiki_e2e` | Disposable PostgreSQL database used only by `pnpm test:e2e`. Its database name must contain `test`, `e2e`, or `ci`. |
| `NEXTWIKI_E2E_MEDIA_ROOT`      | `test-results/e2e-media`                                   | Local media directory used only by `pnpm test:e2e`.                                                                 |
| `PLAYWRIGHT_PORT`              | `3101`                                                     | Local port used by the e2e Next.js server.                                                                          |

These settings are only for local development. Production deployments should expose NoviqWiki through the configured `NEXTWIKI_BASE_URL` and reverse proxy instead.

In production, `NEXTWIKI_BASE_URL` is authoritative even if the database still contains an older
Base URL entered during setup. This prevents a stale admin setting from changing security origin
checks or email/citation links after a deployment hostname change. The stored site Base URL remains
a development/test fallback; keep it aligned for non-production review environments.

## Media Storage

| Variable                        | Example                              | Description                                                                                 |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `NEXTWIKI_MEDIA_DRIVER`         | `local`                              | Media backend. Use `local` for filesystem storage or `s3` for S3-compatible object storage. |
| `NEXTWIKI_MEDIA_ROOT`           | `/app/media`                         | Filesystem path for local media storage inside the app container.                           |
| `NEXTWIKI_STORAGE_PUBLIC_PATH`  | `/media`                             | Fixed same-origin route used for authorized local and S3 media delivery.                    |
| `NEXTWIKI_S3_ENDPOINT`          | `https://s3.us-east-1.amazonaws.com` | S3 or compatible endpoint.                                                                  |
| `NEXTWIKI_S3_REGION`            | `us-east-1`                          | Bucket region.                                                                              |
| `NEXTWIKI_S3_BUCKET`            | `noviqwiki-assets`                   | Bucket for uploaded media.                                                                  |
| `NEXTWIKI_S3_ACCESS_KEY_ID`     | access key                           | Storage access key.                                                                         |
| `NEXTWIKI_S3_SECRET_ACCESS_KEY` | secret                               | Storage secret key.                                                                         |

Use private buckets for production and scope credentials to the media bucket. New S3 signatures are
not persisted or exposed: clients use `/media/{key}`, and the application authorizes and streams
each object. During upgrades, any legacy persisted signed URLs are mapped to the same authorized
route at read time without changing immutable revision records. Readiness needs object read, write,
and delete access for its `.noviqwiki-readiness/` probe prefix; versioned buckets also need
permission to delete the exact probe version. Include the media backend in backup and restore drills.

Upload size and safe MIME type allowlists are site settings managed from `/admin/settings`. The
application hard cap is 10 MiB. The default allowlist is `image/png`, `image/jpeg`, `image/gif`,
`image/webp`, and `application/pdf`; SVG remains rejected by default.

## Email

Email is optional. Password reset and email verification links are created by the application; delivery requires SMTP configuration. Setup and site settings reject the `email_verification` registration mode unless both SMTP variables below are configured, and registration also rejects an unsafe legacy configuration before creating a pending account. Pending users can request another verification message from `/resend-verification`. The public response is deliberately identical for matching and non-matching accounts. A failed resend never supersedes an older usable verification link; after restoring SMTP, retry the resend form.

| Variable              | Example                                 | Description                   |
| --------------------- | --------------------------------------- | ----------------------------- |
| `NEXTWIKI_SMTP_URL`   | `smtp://user:pass@smtp.example.com:587` | SMTP connection URL.          |
| `NEXTWIKI_EMAIL_FROM` | `NoviqWiki <no-reply@example.com>`      | Sender used for system email. |

## Database

Keep the application connection pool below the database provider limit. For horizontally scaled deployments, multiply the per-instance connection count by the maximum number of app instances.

Run migrations with:

```bash
pnpm db:migrate
```

## Production Baseline

Production should set:

```bash
NODE_ENV=production
DATABASE_URL=postgres://nextwiki:secret@postgres.example.com:5432/nextwiki
NEXTWIKI_BASE_URL=https://wiki.example.com
NEXTWIKI_SECRET=replace-with-generated-secret
NEXTWIKI_SETUP_TOKEN=replace-with-separate-one-time-token
NEXTWIKI_MEDIA_DRIVER=s3
```

Omit `NEXTWIKI_TRUSTED_PROXY_HOPS` when the application is exposed directly or the proxy chain is not fixed and trusted.

If local media storage is used in production, `NEXTWIKI_MEDIA_ROOT` must point at persistent storage, not an ephemeral container filesystem.

## Secret Rotation

Rotate `NEXTWIKI_SECRET`, SMTP credentials, and S3 credentials through an intentional maintenance window. Rotating `NEXTWIKI_SECRET` invalidates existing sessions.

Production logs must not include passwords, session tokens, API keys, raw cookies, or full uploaded media contents.
