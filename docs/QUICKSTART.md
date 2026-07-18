# NoviqWiki Quickstart

NoviqWiki is a Next.js App Router application written in TypeScript, backed by PostgreSQL and Drizzle ORM. This guide gets a local development environment running with the same services used by the v0.1.0 application.

## Prerequisites

- Node.js 22 LTS or newer.
- pnpm 10 or newer.
- Docker and Docker Compose.
- PostgreSQL 16 or newer if you are not using Docker Compose.

## 1. Install Dependencies

From the repository root:

```bash
pnpm install
```

## 2. Configure Environment

Create an environment file from the repository template:

```bash
cp .env.example .env
```

Docker Compose fails closed unless the database password, complete application database URL, and
application secret are explicitly configured. Set a strong database password and generate separate
persistent signing and one-time setup secrets:

```bash
POSTGRES_PASSWORD=replace-with-a-strong-hex-password
DATABASE_URL=postgres://nextwiki:replace-with-a-strong-hex-password@db:5432/nextwiki
NEXTWIKI_SECRET=replace-with-a-long-random-secret
NEXTWIKI_SETUP_TOKEN=replace-with-a-separate-one-time-token
```

`POSTGRES_PASSWORD` is the raw password passed to PostgreSQL. `DATABASE_URL` is a complete URL used
by the application and migration runner; Compose does not build it from the password. Keep the two
values consistent, use `db` as the host inside Compose, and percent-encode reserved characters in
the URL username or password. For example, a raw password containing `@` must use `%40` in
`DATABASE_URL`. Hex-generated passwords need no additional encoding.

The default Compose file keeps PostgreSQL on its private service network. If you run `pnpm dev`
directly on the host, opt in to the loopback-only development override and use the configured
database password in a host-reachable URL:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d db
DATABASE_URL=postgres://nextwiki:your-password@localhost:5432/nextwiki pnpm db:migrate
```

The override binds only to `127.0.0.1`; do not modify it to expose PostgreSQL to a network. When
the application itself runs inside Compose, it uses the private `db` service host.

Generate each secret separately. Hex output is safe to use as both the raw PostgreSQL password and
the password component of the Compose database URL:

```bash
openssl rand -hex 32
```

See [CONFIGURATION.md](./CONFIGURATION.md) for the full configuration reference.

## 3. Start PostgreSQL

For host-based development, start the database service with the loopback-only override:

```bash
docker compose -f compose.yaml -f compose.dev.yaml up -d db
```

If the Compose file uses a different service name, inspect it first:

```bash
docker compose config --services
```

## 4. Prepare the Database

Apply Drizzle migrations before starting the app:

```bash
pnpm db:migrate
```

NoviqWiki uses a setup wizard for first-run configuration. If you need deterministic local seed data for development or tests, run:

```bash
pnpm db:seed
```

For production or production-like local testing, complete the setup wizard in the browser to create the first Owner account.

## 5. Run the App

Start the Next.js development server:

```bash
pnpm dev
```

Open `http://localhost:3000` and complete the setup wizard on a fresh database. A production
build requires the deployment `NEXTWIKI_SETUP_TOKEN`; enter it when prompted, then remove the
one-time variable and restart the application after the first Owner is created. Local development
can omit the token. The database setup lock prevents setup from being repeated.

## 6. Run Verification

During development, run the smallest relevant subset first:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Before merging or releasing, run the full gate:

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

The e2e command uses a disposable database named `nextwiki_e2e`, builds the app, and serves it on port `3101` by default. Override `NEXTWIKI_E2E_DATABASE_URL` if your local PostgreSQL setup uses different credentials.

Do not record these commands as passing unless they were run in the current checkout.

## Common Local Issues

### Cannot Connect to PostgreSQL

Confirm that PostgreSQL is listening and that `DATABASE_URL` points to the right host, port, database, user, and password.

```bash
docker compose ps
docker compose logs db
```

### Migrations Fail

Check that the database is empty or at the expected schema version. For disposable local databases, recreate the database and rerun migrations. For shared or production databases, do not drop data; take a backup and inspect the failed migration.

### Authentication Does Not Persist

For local HTTP development, do not force secure cookies. In production, secure cookies must be enabled behind HTTPS.

### Media Does Not Load

Verify the selected storage configuration. Local development can use local/object-storage emulation, while production should use the configured S3-compatible bucket.
