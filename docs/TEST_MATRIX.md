# Test Matrix

| Area      | Requirement                                               | Evidence                                                                                                                |
| --------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Setup     | Fresh setup creates one site and first Owner              | Playwright setup flow; Docker clean `/setup` validation                                                                 |
| Auth      | Login, logout, registration, status checks, rate limiting | Playwright login/logout-adjacent flow; auth services; rate limit table; integration auth recovery                       |
| Recovery  | Password reset and email verification                     | `tests/integration/auth-recovery.test.ts`                                                                               |
| RBAC      | Permissions enforced server-side                          | Domain permission tests/services; admin routes use `requirePermission`; final Owner guard                               |
| Pages     | Create, draft, publish, edit, delete, restore             | Playwright create/edit/publish; admin page actions; integration lifecycle                                               |
| Revisions | Immutable history, diff, rollback                         | Playwright history/diff/rollback; unit diff tests; integration lifecycle                                                |
| Rendering | Sanitized Markdown, wiki links, categories                | `tests/unit/rendering.test.ts`; `tests/unit/wiki-links.test.ts`                                                         |
| Search    | PostgreSQL ranking, filters, permission checks            | Playwright search; integration lifecycle search indexing; `pnpm search:reindex`                                         |
| Media     | Upload, validate, browse, insert syntax, references       | Playwright upload; media service validation/reference lookup; editor media-picker dialog audit; Safari file input audit |
| Admin     | Dashboard, settings, users, groups, roles                 | Playwright user creation; server-rendered admin sections; reset-session modal; admin tab icon and duplicate-entry audit |
| UI reset  | Imported design package applied consistently              | Browser review of homepage, article, search, recent, categories, media, auth, editor, history, diff, admin; icon audit  |
| Theme     | Design package colors and responsive layout               | CSS token inspection; desktop/mobile overflow checks; WebKit mobile sidebar/modal/search-button/file/active-state audit |
| Settings  | Logo, favicon, homepage layout, featured content, SEO     | Admin settings form, homepage rendering, production build, targeted homepage browser audit                              |
| Plugins   | Future extension boundary without v0.1.0 marketplace      | `src/modules/plugins/registry.ts`; homepage contribution collection stays in-process and optional                       |
| Audit     | Append-only audit log and filtering                       | Audit service; auth/page/media/settings actions write audit events                                                      |
| Ops       | Health, readiness, migrations, backup, restore, Docker    | `/api/health`, `/api/ready`, `pnpm db:migrate`, `pnpm backup`, `pnpm restore`, Docker clean deployment                  |
| Security  | XSS, CSRF, uploads, access control, secrets               | Sanitized Markdown, CSP proxy headers, HttpOnly cookies, Zod validation, upload validation, no fixed production secret  |
| A11y      | Keyboard, labels, focus, responsive/mobile                | Semantic forms, skip link, visible focus styles, Playwright mobile article viewport, browser mobile admin/user review   |
