# NoviqWiki Architecture

NoviqWiki is a modular full-stack monolith built with Next.js App Router, TypeScript, PostgreSQL, and Drizzle ORM.

## Runtime Shape

- The Next.js application serves public pages, authenticated workspace screens, admin screens, and `/api/v1` JSON endpoints.
- PostgreSQL stores configuration, users, sessions, RBAC, pages, immutable revisions, drafts, media metadata, audit logs, and search indexes.
- Persistent media storage is abstracted behind local filesystem and S3-compatible adapters.
- Docker Compose runs the application and PostgreSQL for the baseline self-hosted deployment.

## Module Boundaries

- `src/app/**`: route handlers, server-rendered pages, and server actions.
- `src/components/**`: reusable UI components without direct database access.
- `src/modules/**`: domain services, validation, authorization, rendering, search, media, backup, and audit logic.
- `src/modules/plugins/**`: lightweight in-process extension registry reserved for future plugin contributions. v0.1.0 does not load untrusted code, install marketplace packages, or add an extra plugin service.
- `src/db/**`: Drizzle schema, connection management, migrations helpers, and repository helpers.
- `scripts/**`: operational commands for migrations, seed, search reindexing, backup, restore, and OpenAPI generation.

## Security Model

Every privileged operation is authorized server-side through role, group, and permission evaluation. UI visibility is treated as convenience only.

Markdown source is rendered through a sanitized pipeline. Raw HTML is disabled by default. Uploaded media is validated by size, MIME type, filename, storage key, and configured allowlist.

## Site Customization

Site settings store logo and favicon URLs, SEO metadata, homepage layout mode, visible homepage sections, and configured featured page/category slugs. The homepage renders those settings server-side and falls back to recent published content when no featured slugs are configured.
