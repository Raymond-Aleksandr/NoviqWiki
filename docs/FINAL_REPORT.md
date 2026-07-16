# NoviqWiki v0.1.0 Final Report

Generated: 2026-07-16

## Implemented Architecture

NoviqWiki is implemented as a Next.js App Router modular monolith with React, strict TypeScript, PostgreSQL, Drizzle ORM migrations, Zod validation, Argon2id password hashing, DB-backed sessions, a sanitized Unified/Remark/Rehype Markdown pipeline, PostgreSQL full-text search, local/S3 media storage adapters, Vitest, Playwright, Docker Compose, and GitHub Actions.

Domain logic lives in `src/modules/**`. Route handlers and server actions delegate to services; React components do not query the database directly. PostgreSQL stores sites, settings, users, sessions, RBAC, pages, revisions, drafts, redirects/aliases, categories, links, media metadata, audit logs, search index rows, and rate-limit events.

## Completed Functionality

- First-run setup wizard with advisory-lock race protection and initial Owner creation
- Login/logout, registration modes, email verification, password reset, session invalidation, generic login errors, rate limiting, HttpOnly cookies, and CSRF handling
- Users, groups, roles, permissions, built-in role seeding, effective permission checks, and final active Owner protection
- Markdown pages with drafts, publication states, immutable revision history, diff, rollback, optimistic concurrency, redirects, aliases, categories, and page links
- Public homepage, article view, search, categories, recent changes, media library, and responsive Classic theme
- Admin dashboard for pages, users, groups, roles, media, settings, audit logs, and operational status
- Local persistent media storage plus S3-compatible adapter boundary
- Backup, restore, migration, seed, search reindex, and OpenAPI generation scripts
- Docker Compose deployment with PostgreSQL, persistent volumes, non-root app runtime, health check, readiness check, and startup migrations
- CI, Dependabot, issue templates, PR template, and release image workflow

## Important Decisions

- Markdown is the canonical editable format; rendered HTML, plain text, links, headings, and categories are stored derived artifacts on immutable revisions.
- PostgreSQL full-text search is the baseline search engine, with a service boundary for future external search adapters.
- Authentication is local credentials plus database sessions to keep baseline deployment self-contained.
- Setup, login, logout, registration, email verification, and password reset are server-action page flows; `/api/v1` focuses on JSON resource endpoints.
- SVG uploads are disabled by default because unsanitized SVG is unsafe.

## Test Commands and Results

| Command                 | Result |
| ----------------------- | ------ |
| `pnpm format`           | Passed |
| `pnpm lint`             | Passed |
| `pnpm typecheck`        | Passed |
| `pnpm test`             | Passed |
| `pnpm test:integration` | Passed |
| `pnpm build`            | Passed |
| `pnpm test:e2e`         | Passed |
| `pnpm db:generate`      | Passed |
| `pnpm db:migrate`       | Passed |
| `pnpm backup`           | Passed |
| `pnpm restore`          | Passed |
| `pnpm openapi`          | Passed |
| `docker compose config` | Passed |
| `docker compose build`  | Passed |
| `docker compose up`     | Passed |

## Docker Deployment Result

`docker compose down -v && docker compose up --build -d` completed successfully from clean project volumes. The app container became healthy, startup migrations completed, `/api/health` returned `{"data":{"status":"ok"}}`, `/api/ready` returned database and storage readiness, and `/setup` loaded the first-run wizard.

## Security Controls

NoviqWiki includes server-side authorization, Zod boundary validation, Argon2id password hashing, HMAC-protected session and recovery tokens, HttpOnly session cookies, SameSite cookies, CSRF checks for non-server-action writes, generic login/reset messages, authentication rate limiting, CSP and security headers, sanitized Markdown rendering with raw HTML disabled, upload MIME/size validation, randomized storage keys, path traversal protection, secret redaction helpers, and audit events for sensitive actions.

## Known Non-Critical Limitations

- The v0.1.0 admin UI favors straightforward forms over bulk operations and advanced filtering.
- OpenAPI generation is deterministic and committed but intentionally concise; response schemas can be expanded in a later release.
- Screenshot regression is represented by Playwright browser flows and failure screenshots, not a full visual snapshot approval system.
- SMTP delivery is optional; without SMTP, recovery/verification tokens are still created but email is not delivered.

## Recommended Next Release Priorities

- Richer audit filters and export
- More complete OpenAPI schemas
- Optional background job queue for thumbnail generation and email retries
- Expanded visual regression coverage
- More granular private wiki visibility tests
