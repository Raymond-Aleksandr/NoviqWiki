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

| Variable            | Example                                       | Description                                                                             |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | `postgres://nextwiki:secret@db:5432/nextwiki` | PostgreSQL connection string used by Drizzle and server-side services.                  |
| `NEXTWIKI_BASE_URL` | `https://wiki.example.com`                    | Canonical public URL used for redirects, links, and email.                              |
| `NEXTWIKI_SECRET`   | generated 32 byte secret                      | Secret used for session and security-sensitive signing. Must be stable across restarts. |
| `NODE_ENV`          | `production`                                  | Runtime mode. Use `development`, `test`, or `production`.                               |

Generate `NEXTWIKI_SECRET` with:

```bash
openssl rand -base64 32
```

Use the Compose service host `db` when the application runs inside Docker Compose. Use `localhost` when running `pnpm dev` directly on the host against a Compose-managed PostgreSQL port.

## Development-Only Variables

| Variable                       | Example                                                    | Description                                                                                                         |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `NEXTWIKI_ALLOWED_DEV_ORIGINS` | `10.0.0.180`                                               | Comma-separated hosts appended to Next.js `allowedDevOrigins` for LAN/mobile checks against `pnpm dev`.             |
| `NEXTWIKI_E2E_DATABASE_URL`    | `postgres://nextwiki:nextwiki@localhost:5432/nextwiki_e2e` | Disposable PostgreSQL database used only by `pnpm test:e2e`. Its database name must contain `test`, `e2e`, or `ci`. |
| `NEXTWIKI_E2E_MEDIA_ROOT`      | `test-results/e2e-media`                                   | Local media directory used only by `pnpm test:e2e`.                                                                 |
| `PLAYWRIGHT_PORT`              | `3101`                                                     | Local port used by the e2e Next.js server.                                                                          |

These settings are only for local development. Production deployments should expose NoviqWiki through the configured `NEXTWIKI_BASE_URL` and reverse proxy instead.

## Media Storage

| Variable                        | Example                              | Description                                                                                 |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `NEXTWIKI_MEDIA_DRIVER`         | `local`                              | Media backend. Use `local` for filesystem storage or `s3` for S3-compatible object storage. |
| `NEXTWIKI_MEDIA_ROOT`           | `/app/media`                         | Filesystem path for local media storage inside the app container.                           |
| `NEXTWIKI_STORAGE_PUBLIC_PATH`  | `/media`                             | Public URL path used when serving local media.                                              |
| `NEXTWIKI_S3_ENDPOINT`          | `https://s3.us-east-1.amazonaws.com` | S3 or compatible endpoint.                                                                  |
| `NEXTWIKI_S3_REGION`            | `us-east-1`                          | Bucket region.                                                                              |
| `NEXTWIKI_S3_BUCKET`            | `noviqwiki-assets`                   | Bucket for uploaded media.                                                                  |
| `NEXTWIKI_S3_ACCESS_KEY_ID`     | access key                           | Storage access key.                                                                         |
| `NEXTWIKI_S3_SECRET_ACCESS_KEY` | secret                               | Storage secret key.                                                                         |

Use private buckets for production and scope credentials to the media bucket. Include the media backend in backup and restore drills.

Upload size and safe MIME type allowlists are site settings managed from `/admin/settings`. The default allowlist is `image/png`, `image/jpeg`, `image/gif`, `image/webp`, and `application/pdf`; SVG remains rejected by default.

## Email

Email is optional. Password reset and email verification tokens are created by the application; delivery requires SMTP configuration.

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
NEXTWIKI_MEDIA_DRIVER=s3
```

If local media storage is used in production, `NEXTWIKI_MEDIA_ROOT` must point at persistent storage, not an ephemeral container filesystem.

## Secret Rotation

Rotate `NEXTWIKI_SECRET`, SMTP credentials, and S3 credentials through an intentional maintenance window. Rotating `NEXTWIKI_SECRET` invalidates existing sessions.

Production logs must not include passwords, session tokens, API keys, raw cookies, or full uploaded media contents.
