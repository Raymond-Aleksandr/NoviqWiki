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
| `pnpm test`                    | Passed, 9 unit files / 19 tests                     |
| `pnpm test:integration`        | Passed, 3 integration files / 5 tests               |
| `pnpm test:ui`                 | Passed, non-reset Chromium/WebKit UI release audit  |
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

## UI Reset Verification

- 2026-07-16: Applied the imported `NoviqWiki UI reset design.zip` package across the running application instead of treating it as loose inspiration.
- Public surfaces aligned with the package: shell/navigation, homepage, article, search, recent changes, categories, media library, login, registration, recovery, reset, and verification screens.
- Workspace surfaces aligned with the package: Markdown editor, live preview, new-page flow, edit flow, history, unified diff, and rollback controls.
- Admin surfaces aligned with the package: dashboard, pages, users, groups, roles/permissions, settings, audit log, operational status, and admin media.
- Theme colors use the design package tokens (`--bg`, `--surface`, `--surface-muted`, `--surface-sunken`, `--text`, `--primary`, `--border`) with compatibility aliases for automated verification.
- Browser review checked representative desktop and mobile routes on `http://127.0.0.1:3100`; no horizontal overflow remained on the sampled public, editor, and admin user pages after the responsive table fix.
- 2026-07-16: Completed a stricter design-package parity pass for icons, semantic badge colors, admin tabs, setup steps, auth actions, homepage actions, editor preview badges, and mobile admin/history table layouts. Browser DOM audit on 599px-wide viewport found no visible command controls without icons and no horizontal overflow on sampled public, editor, admin, and history routes.
- 2026-07-16: Recovered ignored media source files by narrowing root media/backups ignore rules, completed the design-package media library workflow with search, selection, copy URL/Markdown, reference lookup, and guarded deletion, and disabled the Next.js dev indicator that visually overlapped the mobile admin dashboard during local review.
- 2026-07-16: Re-ran desktop and mobile Playwright screenshot/DOM audit across homepage, article, search, recent changes, categories, media, editor, history/diff, admin dashboard, admin sections, and mobile admin/media. Design tokens matched the package (`#2c5f8f`, `#ffffff`, `#1e2328`), there was no horizontal overflow, oversized hidden icons, or abnormal checkbox/radio sizing.
- 2026-07-16: Added the MediaWiki/Wikipedia-style "What links here" workflow: article tool link, backlinks page, API endpoint, OpenAPI entry, integration coverage, and E2E coverage. Article pages now expose page information, categories, inbound/outbound link counts, and permanent-link tooling.
- 2026-07-16: Fixed Safari/iOS-style form-control drift by applying a project-level form reset: native `select` appearance is removed and replaced with a stable CSS chevron, inputs/selects have fixed box sizing and 42px control height, and checkbox/radio controls are consistently drawn across admin, setup, media deletion, and role-permission forms.
- 2026-07-16: Rechecked the previously broken admin operational-status card at 599px and 390px widths; status rows no longer overflow or truncate. Rechecked `/admin/groups` form layout after the Safari reset; real inputs/selects measured 42px tall with no horizontal overflow.
- 2026-07-16: Confirmed local working-directory size is dominated by ignored generated artifacts (`.next` and `node_modules`). Git-tracked source/docs/config total is approximately 1.2 MB; `.next`, `node_modules`, `test-results`, `media`, and `.env` remain ignored and out of the committed repository.
- 2026-07-16: Expanded the English/Simplified Chinese translation set and wired it into the shell, homepage, article page, page tools, backlinks, media library, recent changes, categories, search, auth/recovery pages, editor, history, diff, admin navigation, admin dashboard, pages, users, groups, roles, settings, audit, status, localized date display, server action success messages, and first-run setup wizard.
- 2026-07-16: Smoke-tested `noviqwiki-locale=zh-CN` on mobile-width homepage/media/recent/categories/search/article/admin groups/admin settings/admin status. The previously reported media library page now shows Chinese labels for upload, file, alt text, search, empty state, copy actions, references, and delete controls. No sampled page had horizontal overflow.
- 2026-07-16: Added explicit default-language controls to first-run setup and admin site settings, persisted setup Owner/admin-created user locales from the site default, and switched the live review database to `zh-CN`. Browser verification on `http://localhost:3100/media` now reports `lang=zh-CN`, Chinese media-library heading/description/empty state, and no horizontal overflow.
- 2026-07-16: Tightened locale resolution to prefer explicit locale cookie, then active user locale, then browser `Accept-Language`, then site default. Localized common service/API errors for auth, setup, validation, pages, revisions, categories, redirects, media, users, and permission failures. Verified the live API with `noviqwiki-locale=zh-CN` returning `未找到分类。` and `noviqwiki-locale=en` returning `Category not found.` for the same missing category request.
- 2026-07-16: Ran a release UI audit across 72 combinations: Chromium and WebKit, desktop 1280px and mobile 390px, public routes, editor, and authenticated admin routes. Fixed the duplicate article History action, removed a decorative no-op admin pages icon, raised compact/action/touch targets to stable sizes, localized visible page/user status enum labels, and verified zero horizontal overflow, zero duplicate controls, zero undersized visible controls, zero visible stray dialogs/popovers, and zero pressed-state size drift.
- 2026-07-16: Applied the `NoviqWiki.html` design package modal language to editor media insertion, media deletion, page deletion, and revision rollback. Mobile sidebar navigation now compacts into a horizontal strip instead of occupying the first viewport. Admin user row action feedback now uses compact status dots so messages such as `会话已重置。` do not break mobile rows.
- 2026-07-16: Added lightweight site customization for release: configured logo/favicon URLs, default homepage, homepage layout mode, homepage section visibility, featured page/category slug lists, and SEO title/description. The homepage now consumes configured featured slugs before falling back to recent content.
- 2026-07-16: Added a minimal `src/modules/plugins/registry.ts` extension boundary for future in-process plugin contributions without introducing a marketplace, runtime loader, or extra service dependency in v0.1.0.
- 2026-07-16: Moved homepage section normalization and category priority ordering into `src/modules/settings/homepage.ts`, added unit coverage for defaults, invalid stored layouts, duplicate featured category slugs, and plugin homepage contribution collection, and kept homepage customization behavior server-rendered and lightweight.
- 2026-07-16: Targeted mobile release UI audit passed on Chromium and WebKit at `439x734`: homepage sidebar <= 150px, no duplicate visible homepage search buttons, compact admin user status feedback, editor media picker dialog, page/media delete confirmation dialogs, and no horizontal overflow on homepage, admin users, editor, admin pages, or media.
- 2026-07-16: Fixed the remaining Safari/mobile polish issues from live review. The mobile sidebar now collapses to a 70px horizontal strip at `439x734`, topbar search icon buttons are fixed at `32x32`, Safari file-upload controls render as 46px design-package fields, and admin reset-session actions now open the same design-package confirmation modal used by deletion/rollback flows. Re-ran a focused Chromium/WebKit desktop/mobile route and modal audit with zero failures.
- 2026-07-16: Removed the remaining duplicated admin operation entries: the global settings gear is hidden while inside `/admin` because the admin tab bar already exposes settings, and the groups/roles pages no longer show redundant "new" anchors immediately above their create forms. Admin tabs now include icons, and the button pressed state uses inset feedback without transform displacement. Chromium/WebKit desktop/mobile admin audit verified one settings entry per admin page, icon coverage on all admin tabs, no visible `#create-*` anchors, no sub-32px controls, and no active-state transform.
- 2026-07-16: Standardized remaining command buttons with design-package icon+text treatment across auth/recovery/verification, search, first-run setup navigation, and admin settings save. A Chromium/WebKit desktop/mobile command-control audit of homepage, search, auth/recovery pages, admin settings, and editor found no visible command buttons without icons, no horizontal overflow, and no sub-32px command targets.
- 2026-07-16: Added `pnpm test:ui`, a repeatable non-reset Chromium/WebKit desktop/mobile release audit for live review databases and the `NoviqWiki.html` design-package requirements. It covers public routes, authenticated admin/editor routes, media picker/page delete modals, active button states, history controls, and the first discoverable diff route, and the local authenticated run passed with zero icon, overflow, dialog, duplicate-control, tiny-control, Safari form-control, modal consistency, or pressed-state failures.
- 2026-07-16: Expanded `pnpm test:ui` to lock down the remaining live-review regressions: mobile sidebar height/width, media deletion confirmation, and admin user reset-session confirmation now use the same non-reset Chromium/WebKit desktop/mobile audit. The authenticated local run passed without opening destructive confirmation submissions.
- 2026-07-16: Expanded the non-reset UI release audit to cover registration, article backlinks, and the first discoverable category detail page in addition to the existing public, editor, admin, modal, and diff routes. The authenticated local Chromium/WebKit desktop/mobile run passed without database reset.
- 2026-07-16: Added light/dark design token checks to `pnpm test:ui` so the design package colors, radius token, and font stacks are now release-gated alongside layout, modal, icon, and Safari form-control checks.
- 2026-07-16: Added a production-source native dialog scan to `pnpm test:ui`; release UI checks now fail if `src` reintroduces browser `alert`, `confirm`, `prompt`, or `beforeunload` flows instead of the design-package modal components.
- 2026-07-16: Added a CSS source scan to `pnpm test:ui` that rejects non-`none` `transform` declarations inside `:active` rules, guarding against pressed-button movement returning through future stylesheet edits.
- 2026-07-16: Exposed page rename/move from `/admin/pages` with the design-package confirmation modal, editable title/slug fields, and a default option to keep the previous slug as a redirect. The page lifecycle integration test now verifies old-slug resolution, alias-backed search, and unchanged immutable revision count after rename.
- 2026-07-16: Added `NEXTWIKI_ALLOWED_DEV_ORIGINS` so local dev servers can safely allow LAN/mobile browser review without hardcoding workstation IP addresses. The live review server was restarted on `0.0.0.0:3100` and validated through `http://10.0.0.180:3100`.
- 2026-07-16: Removed the duplicated global topbar search from every route. Search entry now flows through the homepage hero action or the dedicated `/search` page form, while `/search` remains fully functional on mobile and desktop.
- 2026-07-16: Fixed the mobile Safari/search-page navigation regression by preventing the mobile shell grid from stretching short pages and forcing compact content-width sidebar nav items. WebKit mobile verification shows the sidebar at 59px tall and the `阅读` nav item at 36px tall on empty and populated search pages.
- 2026-07-16: Improved PostgreSQL search recall with prefix full-text matching and safe substring fallback across title, aliases, categories, and plain text. Live verification confirmed `/api/v1/search?q=test` and `/search?q=test` return the `Testing` category article, and integration coverage now locks `test` matching `Testing`.
- 2026-07-16: Hardened the search route after live review by forcing the `/search` page and `/api/v1/search` endpoint to render dynamically, rebuilding the live search index, and adding E2E coverage that verifies `test` finds the article categorized as `Testing`. LAN browser verification on `http://10.0.0.180:3100/search?q=test` showed `1 条结果` and no console errors.
- 2026-07-16: Completed the JSON page lifecycle API by adding `PATCH /api/v1/pages/{id}` restore support through `{"action":"restore"}`. Page draft/delete/restore audit writes now use the caller-provided database connection, and integration coverage verifies soft-delete removes pages from search while restore reindexes them.
- 2026-07-16: Completed the v0.1.0 page protection workflow. `/admin/pages` now exposes design-package protect/unprotect confirmation controls, `PATCH /api/v1/pages/{id}` accepts `protectionLevel`, service-layer write paths enforce protected pages server-side, audit logs record protection changes through `page.updated`, and integration coverage verifies Editors are blocked while Owners can protect, edit, and unprotect pages.
- 2026-07-16: Wired `/recent` filter pills to `?type=` URLs backed by audit-log action groups for created, edited, published, rollback, and media activity. Published page creation now records `page.created` separately from `page.published`, while draft creation remains excluded from public recent changes to avoid leaking unpublished titles.
- 2026-07-16: Completed global private wiki read enforcement. `publicMode=false` now removes anonymous read permissions for site/page/revision/media reads, public content routes redirect unauthenticated visitors to login, direct media file URLs fail closed, `/api/v1` read endpoints inherit the same permission check, and integration coverage verifies anonymous access flips from allowed to denied while Owner access remains intact.
- 2026-07-16: Improved redirect transparency on article pages. Pages resolved through an alias now show a design-package notice with the original `/page/{slug}` source, while the existing alias resolution and redirect-loop protections remain service-layer behavior. SSR unit coverage verifies the redirect origin is rendered.
- 2026-07-16: Hardened page slug and alias integrity. Page creation and rename now reject slugs already reserved by another page alias, while allowing a page to move back to its own previous slug and clearing the self-alias. Integration coverage verifies aliases cannot be shadowed by new pages or other page renames.
- 2026-07-16: Completed the page archive lifecycle. Admin pages now expose a design-package archive confirmation flow, archived pages keep revision history and direct URLs, archive removes pages from the search index, restore clears `archivedAt` and reindexes published content, `/api/v1/pages/{id}` accepts `{"action":"archive"}`, and integration coverage verifies archive/restore search behavior plus protected-page enforcement.
- 2026-07-16: Tightened mobile history typography after live Safari review. History summary rows now use a dedicated label/summary/date grid so edit summaries such as `Rollback to revision 1` stay readable instead of being squeezed into centered multi-line text; browser verification at `439x734` showed no horizontal overflow.
- 2026-07-16: Made `/admin/pages` filtering functional. The design-package filter bar now submits `q` and `status` query parameters, supports title/slug search, draft/published/archived/deleted filtering, clear-filter navigation, empty-state rendering, and integration coverage for the underlying page listing filters.
- 2026-07-16: Normalized `/admin/pages` filter control sizing after mobile review. The search field, status select, search button, clear-filter action, and create-page action now share a 42px toolbar height, while nested input/select elements no longer inherit form-field min-height that made the filter controls look oversized.
- The browser plugin emitted external Statsig networking noise unrelated to NoviqWiki; application routes and quality gates were clean.

## Notes

- A live development server is currently running locally on port `3100` for visual review. Do not stop it while live review is in progress.
- The Docker Compose deployment path has also been validated on port `3000` during release checks.
- `pnpm test:e2e` was last run before the live-review i18n/API localization pass and passed; it was not re-run afterward because the project E2E reset flow intentionally recreates the database and would disrupt the live server state under review.
- SMTP is optional. Password reset and email verification tokens are created server-side; email delivery happens when `NEXTWIKI_SMTP_URL` and `NEXTWIKI_EMAIL_FROM` are configured.
