# Test Matrix

| Area      | Requirement                                               | Evidence                                                                                                               |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Setup     | Fresh setup creates one site and first Owner              | Playwright setup flow; Docker clean `/setup` validation                                                                |
| Auth      | Login, logout, registration, status checks, rate limiting | Playwright login/logout-adjacent flow; auth services; rate limit table; integration auth recovery                      |
| Recovery  | Password reset and email verification                     | `tests/integration/auth-recovery.test.ts`                                                                              |
| RBAC      | Permissions enforced server-side                          | Domain permission tests/services; admin routes use `requirePermission`; final Owner guard                              |
| Pages     | Create, draft, publish, edit, delete, restore             | Playwright create/edit/publish; admin page actions; integration lifecycle                                              |
| Revisions | Immutable history, diff, rollback                         | Playwright history/diff/rollback; unit diff tests; integration lifecycle                                               |
| Rendering | Sanitized Markdown, wiki links, categories                | `tests/unit/rendering.test.ts`; `tests/unit/wiki-links.test.ts`                                                        |
| Search    | PostgreSQL ranking, filters, permission checks            | Playwright search; integration lifecycle search indexing; `pnpm search:reindex`                                        |
| Media     | Upload, validate, browse, insert syntax, references       | Playwright upload; media service validation and reference lookup                                                       |
| Admin     | Dashboard, settings, users, groups, roles                 | Playwright user creation; server-rendered admin sections                                                               |
| Audit     | Append-only audit log and filtering                       | Audit service; auth/page/media/settings actions write audit events                                                     |
| Ops       | Health, readiness, migrations, backup, restore, Docker    | `/api/health`, `/api/ready`, `pnpm db:migrate`, `pnpm backup`, `pnpm restore`, Docker clean deployment                 |
| Security  | XSS, CSRF, uploads, access control, secrets               | Sanitized Markdown, CSP proxy headers, HttpOnly cookies, Zod validation, upload validation, no fixed production secret |
| A11y      | Keyboard, labels, focus, responsive/mobile                | Semantic forms, skip link, visible focus styles, Playwright mobile article viewport                                    |
