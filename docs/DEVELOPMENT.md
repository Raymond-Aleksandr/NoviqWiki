# NoviqWiki Development

NoviqWiki is a TypeScript monolith built with Next.js App Router, PostgreSQL, and Drizzle ORM. The application code is organized around domain modules rather than database access from UI components.

## Project Structure

Expected top-level layout:

| Path                | Purpose                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/app`           | Next.js App Router pages, layouts, route handlers, server actions, and `/api/v1` endpoints.              |
| `src/modules`       | Domain services, validation, authorization, rendering, search, media, backup, audit, and business logic. |
| `src/db`            | Drizzle schema, database client, migration helpers, and repository helpers.                              |
| `src/components`    | React components that render UI and call server actions or receive data from routes.                     |
| `src/lib`           | Shared infrastructure utilities that are not domain-specific.                                            |
| `tests/unit`        | Fast unit tests.                                                                                         |
| `tests/integration` | Database and service integration tests.                                                                  |
| `tests/e2e`         | Browser-level end-to-end tests.                                                                          |
| `docs`              | Operator, developer, and user-facing documentation.                                                      |

## Core Rules

- Keep domain logic in `src/modules/**`.
- React components must not query the database directly.
- Route handlers and server actions validate input with Zod.
- Route handlers and server actions delegate to domain services.
- Enforce authorization server-side for every privileged operation.
- Markdown is canonical page source.
- Store sanitized rendered HTML and searchable plain text in immutable revisions.
- Do not add MediaWiki compatibility, migration, extension, or API behavior.

## Development Setup

Install dependencies:

```bash
pnpm install
```

Configure `.env.local`:

```bash
DATABASE_URL=postgres://nextwiki:nextwiki@db:5432/nextwiki
NEXTWIKI_BASE_URL=http://localhost:3000
NEXTWIKI_SECRET=replace-with-a-long-random-secret
NEXTWIKI_MEDIA_DRIVER=local
NEXTWIKI_MEDIA_ROOT=/app/media
NEXTWIKI_STORAGE_PUBLIC_PATH=/media
```

Start dependencies:

```bash
docker compose up -d db
```

Apply migrations:

```bash
pnpm db:migrate
```

Run the app:

```bash
pnpm dev
```

For LAN/mobile review, bind the dev server to all interfaces and allow the workstation IP:

```bash
NEXTWIKI_ALLOWED_DEV_ORIGINS=10.0.0.180 pnpm exec next dev -H 0.0.0.0 -p 3100
```

Replace `10.0.0.180` with the host IP shown by your operating system. Phones and tablets must be on the same network.

## Workflow

For a typical feature:

1. Define or update the domain service in `src/modules`.
2. Add database schema or query helpers in `src/db` when persistence changes.
3. Validate route/server-action input with Zod.
4. Call the domain service from the route or server action.
5. Render data through React components without direct database access.
6. Add audit logging for privileged or operational actions.
7. Add focused unit, integration, or end-to-end coverage based on risk.
8. Update relevant docs when behavior, setup, or verification changes.

## Database Changes

Schema changes must be represented as Drizzle migrations. Review generated SQL before applying it to shared environments.

Local migration workflow:

```bash
pnpm db:generate
pnpm db:migrate
```

If the migration affects production data, document the rollback or restore plan in the pull request or release notes.

## Content Pipeline

When a page is saved:

1. Validate the input.
2. Authorize the actor.
3. Store the Markdown source in a new revision.
4. Render Markdown to HTML.
5. Sanitize rendered HTML.
6. Extract searchable plain text.
7. Update categories and wiki-link references where the domain workflow requires it.
8. Mark the new revision as the current page revision in the same transaction.

Historical revisions are immutable.

## Authorization Development

Every mutating service should accept an actor or service context that identifies the current user. Do not rely on UI visibility for security.

Test both allowed and denied paths for privileged operations. Denied paths should fail without changing data.

## Quality Gates

Use the smallest relevant subset while iterating:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Before completion, run:

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

If a command cannot run in the current environment, record the reason in the handoff.

`pnpm test:e2e` resets only a disposable e2e database and runs a production `next build` plus `next start` browser server on port `3101` by default, so it can run while the live review app remains available on port `3100`. Set `NEXTWIKI_E2E_DATABASE_URL` when local PostgreSQL credentials differ from the default `postgres://nextwiki:nextwiki@localhost:5432/nextwiki_e2e`.
