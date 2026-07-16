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
