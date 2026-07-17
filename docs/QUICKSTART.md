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

Create a local environment file from the repository template:

```bash
cp .env.example .env.local
```

For local Docker Compose evaluation, no environment file is required. If `NEXTWIKI_SECRET` is omitted, the container generates an ephemeral runtime secret so setup and login flows can run immediately. Sessions are invalidated when that container is recreated, so set a persistent secret before production use or any long-lived installation:

```bash
NEXTWIKI_SECRET=replace-with-a-long-random-secret
```

If you run `pnpm dev` directly on the host while PostgreSQL runs in Docker Compose, use a host-reachable database URL:

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@localhost:5432/nextwiki
```

When the application itself runs inside Docker Compose, use the Compose service host from `.env.example`.

Use a generated secret:

```bash
openssl rand -base64 32
```

See [CONFIGURATION.md](./CONFIGURATION.md) for the full configuration reference.

## 3. Start PostgreSQL

Start the database service:

```bash
docker compose up -d db
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

Open `http://localhost:3000` and complete the setup wizard on a fresh database.

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
