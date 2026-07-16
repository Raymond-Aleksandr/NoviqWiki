# Contributing

Thank you for contributing to NoviqWiki.

## Development

```bash
pnpm install
pnpm dev
```

Before submitting changes, run:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Do not add MediaWiki compatibility or migration behavior to this repository. Migration tools may be separate projects later.
