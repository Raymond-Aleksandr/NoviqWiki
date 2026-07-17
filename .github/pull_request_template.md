## Summary

-

## Verification

- [ ] `pnpm format`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm test:integration`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] `docker compose config`
- [ ] `docker compose build`

## Checklist

- [ ] Domain logic stays in `src/modules/**`; route handlers and server actions delegate to services.
- [ ] Privileged operations enforce authorization server-side.
- [ ] Inputs are validated with Zod at route handler or server action boundaries.
- [ ] Markdown remains canonical page source; rendered HTML and search text are derived from immutable revisions.
- [ ] No MediaWiki compatibility, migration, extension, or API behavior was added.
- [ ] User-facing documentation was updated when commands, configuration, deployment, API behavior, or security guidance changed.
