# NoviqWiki

NoviqWiki is a self-hosted, open-source wiki platform built as a TypeScript modular monolith. It provides public article browsing, Markdown editing, immutable revisions, revision diff and rollback, PostgreSQL full-text search, RBAC, media management, administration, audit logs, backup/restore tooling, and Docker-based deployment.

The project is not a MediaWiki fork, wrapper, migration utility, compatibility layer, extension host, or Wikitext implementation.

## Features

- First-run setup wizard with initial Owner creation
- Username/email login, registration modes, email verification, password reset, HttpOnly sessions, CSRF checks, and Argon2id password hashing
- Users, groups, built-in roles, granular permissions, and final Owner protection
- Markdown pages with drafts, publication, immutable revisions, optimistic concurrency, redirects, categories, wiki links, table of contents, diff, and rollback
- PostgreSQL full-text search with category filters and ranked excerpts
- Local media storage by default, optional S3-compatible storage, MIME/size validation, randomized storage keys, and media references
- Classic responsive wiki UI with light/dark tokens, public homepage, article layout, recent changes, and admin dashboard
- Versioned `/api/v1` JSON endpoints and generated OpenAPI artifact
- Docker Compose deployment, migrations, health/readiness endpoints, structured logging, backup and restore scripts
- Vitest unit/integration tests, Playwright e2e tests, GitHub Actions, Dependabot, release image workflow

## Quick Start

```bash
docker compose up --build -d
```

Open <http://localhost:3000/setup> and complete the setup wizard. Set a persistent `NEXTWIKI_SECRET` before using a production instance.

## Development

```bash
pnpm install
pnpm dev
```

Required local services:

- Node.js 22+
- pnpm 10+
- PostgreSQL 17, or the included Compose database

Common commands:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm search:reindex
pnpm backup
pnpm restore
```

## Documentation

- [Quickstart](docs/QUICKSTART.md)
- [Configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Authorization](docs/AUTHORIZATION.md)
- [Content format](docs/CONTENT_FORMAT.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Backup and restore](docs/BACKUP_RESTORE.md)
- [API](docs/API.md)
- [Testing](docs/TESTING.md)
- [Final report](docs/FINAL_REPORT.md)

## Project Status

Version target: `0.1.0`. See [docs/STATUS.md](docs/STATUS.md) and [docs/TEST_MATRIX.md](docs/TEST_MATRIX.md) for implementation and verification evidence.

## License

Apache-2.0. See [LICENSE](LICENSE).
