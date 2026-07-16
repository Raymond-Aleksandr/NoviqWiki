# NoviqWiki v0.1.0 Status

Last updated: 2026-07-16

## Repository State

- Project name: NoviqWiki
- Location: `~/Downloads/Projects/NoviqWiki`
- Starting state: empty directory
- Current milestone: Milestone 8, Production readiness
- Release target: usable self-hosted v0.1.0

## Milestone Progress

| Milestone                    | Status   | Evidence                                                                                                |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| 1. Foundation                | Complete | Next.js App Router, strict TypeScript, Drizzle schema/migration, Docker, CI, lockfile                   |
| 2. Installation and identity | Complete | Setup wizard, Owner creation, sessions, login/logout/register, password reset, email verification, RBAC |
| 3. Content engine            | Complete | Pages, drafts, publish, Markdown renderer, wiki links, categories, revisions, redirects                 |
| 4. Public experience         | Complete | Classic theme, homepage, article pages, search, categories, recent changes, responsive shell            |
| 5. Editing and history       | Complete | CodeMirror Markdown editor, preview, drafts, conflict checks, history, diff, rollback                   |
| 6. Media                     | Complete | Local/S3 storage boundary, validation, upload, browse, public serving, references                       |
| 7. Administration            | Complete | Dashboard, pages, users, groups, roles, media, settings, audit, status                                  |
| 8. Production readiness      | Complete | Security controls, docs, tests, backup/restore scripts, Docker validation                               |

## Verification Log

| Command                        | Result                                              |
| ------------------------------ | --------------------------------------------------- |
| `pnpm format`                  | Passed                                              |
| `pnpm lint`                    | Passed                                              |
| `pnpm typecheck`               | Passed                                              |
| `pnpm test`                    | Passed, 5 unit files / 10 tests                     |
| `pnpm test:integration`        | Passed, 2 integration files / 2 tests               |
| `pnpm build`                   | Passed                                              |
| `pnpm test:e2e`                | Passed, 2 Playwright tests                          |
| `pnpm db:migrate`              | Passed                                              |
| `pnpm backup`                  | Passed, generated SQL and local media archive       |
| `pnpm restore`                 | Passed with generated backup and confirmation       |
| `pnpm openapi`                 | Passed, generated `docs/openapi.json`               |
| `docker compose config`        | Passed                                              |
| `docker compose build`         | Passed                                              |
| `docker compose up --build -d` | Passed from clean project volumes after final gates |
| `GET /api/health`              | Passed, `{"data":{"status":"ok"}}`                  |
| `GET /api/ready`               | Passed, database/storage true                       |
| `GET /setup`                   | Passed, first-run setup page loads                  |

## Notes

- The Docker Compose app is currently running locally on port `3000` after the final clean deployment validation.
- SMTP is optional. Password reset and email verification tokens are created server-side; email delivery happens when `NEXTWIKI_SMTP_URL` and `NEXTWIKI_EMAIL_FROM` are configured.
