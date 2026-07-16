# NoviqWiki v0.1.0 Implementation Plan

This document tracks the release implementation for NoviqWiki v0.1.0.

## Milestones

1. Foundation: scaffold, strict TypeScript, database schema, migrations, Docker, CI.
2. Installation and identity: setup wizard, owner account, sessions, registration modes, RBAC.
3. Content engine: pages, Markdown renderer, wiki links, categories, revisions, drafts, redirects.
4. Public experience: Classic theme, homepage, article pages, search, categories, recent changes.
5. Editing and history: editor, preview, drafts, conflict detection, history, diff, rollback.
6. Media: storage adapters, upload validation, media library, editor insertion.
7. Administration: dashboard, pages, users, groups, roles, settings, audit, operations status.
8. Production readiness: security, accessibility, backup/restore, docs, tests, release prep.

## Execution Loop

For each milestone:

1. Implement the next vertical slice.
2. Run formatting, linting, type checking, tests, and builds as relevant.
3. Exercise the affected browser or API workflow.
4. Repair failures.
5. Update `docs/STATUS.md` and `docs/TEST_MATRIX.md`.
6. Commit a logical checkpoint when Git is available and safe.
