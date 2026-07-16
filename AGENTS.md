# NoviqWiki Agent Notes

NoviqWiki is a TypeScript/Next.js App Router monolith backed by PostgreSQL and Drizzle ORM.

## Working Rules

- Keep domain logic in `src/modules/**`; React components must not query the database directly.
- Route handlers and server actions validate input with Zod and delegate to domain services.
- Enforce authorization server-side for every privileged operation.
- Markdown is canonical page source. Store sanitized rendered HTML and searchable plain text in immutable revisions.
- Do not add MediaWiki compatibility, migration, extension, or API behavior to this repository.
- Update `docs/STATUS.md` and `docs/TEST_MATRIX.md` when a milestone or verification result changes.

## Quality Gates

Run the relevant subset while developing and the full suite before completion:

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
