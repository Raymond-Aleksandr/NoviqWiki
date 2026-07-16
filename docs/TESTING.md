# NoviqWiki Testing

NoviqWiki uses layered verification: formatting, linting, TypeScript checks, unit tests, integration tests, build verification, end-to-end tests, and Docker Compose validation.

Do not claim a command passed unless it was run in the current checkout.

## Command Reference

Run while developing:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

Run before completion or release:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:ui
pnpm test:e2e
docker compose config
docker compose build
```

## Unit Tests

Unit tests should cover pure domain behavior and small service boundaries without a browser or real network.

Prioritize:

- Authorization decisions.
- Markdown rendering helpers.
- Slug generation and validation.
- Revision creation rules.
- Input normalization.

Run:

```bash
pnpm test
```

## Integration Tests

Integration tests cover database-backed services, route handlers, migrations, and transactional behavior.

Prioritize:

- Creating a page and first revision.
- Editing a page creates a new immutable revision.
- Search text is derived from rendered content.
- Unauthorized actors cannot mutate content.
- Restricted pages do not leak through reads or search.
- Media metadata is persisted correctly.

Run:

```bash
pnpm test:integration
```

Integration tests need a disposable PostgreSQL database. Do not point integration tests at production or shared staging data.

## UI Release Audit

The UI release audit is a non-reset browser audit for live review builds. It does not recreate the database and is safe to run against a local app that is already being inspected.

It checks:

- Chromium and WebKit at desktop and mobile widths.
- Public homepage, search, recent changes, category index/detail, media, auth, recovery, reset, verification, registration, article, backlinks, history, and the first discoverable diff route.
- Authenticated editor and admin routes when credentials are provided.
- Light theme design tokens for background, surface, muted surface, sunken surface, text, primary, border, radius, and font stacks.
- Horizontal overflow.
- Sub-32px command targets.
- Safari/WebKit checkbox, radio, and file-input sizing.
- Stray visible dialogs on initial route load.
- Design-package modal radius/backdrop for editor media picker, page deletion, media deletion, and user session reset confirmation when matching data exists.
- Mobile shell/sidebar height and width drift.
- Duplicate admin settings entries.
- Missing icons on visible command buttons.
- History controls, backlinks, category cards, and the first discoverable diff route.
- Button active-state transform drift.

Run public-route checks against a running local app:

```bash
pnpm test:ui
```

Run the full authenticated audit:

```bash
UI_AUDIT_BASE_URL=http://localhost:3100 \
UI_AUDIT_USERNAME=owner \
UI_AUDIT_PASSWORD=replace-with-local-password \
UI_AUDIT_ARTICLE_SLUG=e2e-article \
pnpm test:ui
```

If `UI_AUDIT_USERNAME` and `UI_AUDIT_PASSWORD` are omitted, authenticated admin/editor routes are skipped. This command is separate from `pnpm test:e2e`, which intentionally resets the database first.

## End-to-End Tests

End-to-end tests cover browser workflows through the Next.js app.

Critical v0.1.0 flows:

- Setup wizard creates the first Owner on a fresh database.
- Sign in and sign out.
- Auth status checks and login rate limiting work.
- Owner or authorized admin creates users, groups, roles, and permissions.
- Editor creates a draft.
- Editor publishes a page.
- Editor updates a page and sees revision history and diffs.
- Viewer can read allowed content.
- Viewer cannot access admin or editor actions.
- Search finds visible content only.
- Categories and internal wiki links render and filter correctly.
- Media upload and embedded media rendering work if uploads are enabled.
- Health and readiness endpoints report expected status.

Run:

```bash
pnpm test:e2e
```

## Build Verification

Run:

```bash
pnpm build
```

The build should fail on TypeScript, Next.js, or server/client boundary errors that are not caught by faster tests.

## Docker Verification

Validate Docker Compose syntax:

```bash
docker compose config
```

Build containers:

```bash
docker compose build
```

When debugging container-only failures, inspect service logs:

```bash
docker compose logs --tail=200 app
```

Use the actual service name from `docker compose config --services` if it differs from `app`.

## Test Data

Use deterministic fixtures:

- Admin user.
- Editor user.
- Viewer user.
- Public page.
- Restricted page.
- Page with multiple revisions.
- Page with Markdown table, code block, and math.
- Uploaded media or attachment fixture when uploads are enabled.

Tests should create their own records or run against a known seed. They should not depend on local manual edits.

## Security Regression Coverage

Every privileged operation needs at least one denied-path test. A denied-path test should assert both the response and the absence of data mutation.

Examples:

- Viewer cannot create a page.
- Editor cannot manage users.
- Anonymous user cannot view restricted content.
- Search does not return restricted content to unauthorized users.
- Media upload endpoint rejects oversized or unsupported files.

## Reporting Results

When handing off testing status, include:

- Exact command.
- Pass/fail result.
- Relevant failure output.
- Environment notes, such as missing Docker or unavailable database.

Example:

```text
pnpm test:integration was not run because PostgreSQL was not available in this environment.
```
