# NoviqWiki API

NoviqWiki v0.1.0 exposes versioned JSON endpoints under `/api/v1` for pages, revisions, search, categories, media, current user state, and administration reads. First-run setup, login, logout, registration, password reset, email verification, and verification-email resend are implemented through Next.js server actions and pages rather than JSON endpoints. Public recovery requests return generic responses and perform delivery after the response boundary.

Generate the OpenAPI file with:

```bash
pnpm openapi
```

The generated artifact is `docs/openapi.json`.

## Conventions

Base URL:

```text
https://wiki.example.com/api/v1
```

Responses use JSON. Media upload accepts `multipart/form-data`.

Cookie-authenticated `POST`, `PATCH`, and `DELETE` requests must be same-origin and include the
current CSRF value in `X-CSRF-Token`. Obtain it from `GET /api/v1/me`; the response exposes only
the safe user DTO and CSRF value, never credentials or password hashes.

Error shape:

```json
{
  "error": {
    "code": "forbidden",
    "message": "You do not have permission to perform this action."
  }
}
```

Common status codes:

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `400`  | Invalid request body, query string, or route parameter. |
| `401`  | Authentication required.                                |
| `403`  | Authenticated user lacks the required permission.       |
| `404`  | Resource not found or not visible to the actor.         |
| `409`  | Conflict, such as duplicate slug or stale edit.         |
| `413`  | Media upload exceeds configured size limit.             |
| `415`  | Unsupported media type.                                 |
| `429`  | Rate limit exceeded.                                    |
| `500`  | Unhandled server error.                                 |

## Endpoints

### Current User

```http
GET /api/v1/me
```

Returns the current authenticated user or `null` plus the CSRF value required by mutation
requests.

### Pages

```http
GET /api/v1/pages
POST /api/v1/pages
GET /api/v1/pages/{id}
PATCH /api/v1/pages/{id}
DELETE /api/v1/pages/{id}
POST /api/v1/pages/{id}/rollback
GET /api/v1/pages/{id}/revisions
GET /api/v1/pages/{id}/backlinks
```

The API delegates to the same page services as the server-rendered UI. Page listings default to
published content; draft, archived, and deleted listings require elevated editing or restore
permissions. `POST` and `PATCH` require page permissions and validate title, bounded Markdown,
summary, publish intent, and optimistic concurrency fields. Empty or mixed-operation PATCH bodies
are rejected. `PATCH /api/v1/pages/{id}` accepts `{"action":"archive"}` to archive a page and
remove it from search when the actor has `page.delete`, `{"action":"restore"}` to restore a
soft-deleted or archived page when the actor has `page.restore`, and
`{"protectionLevel":"protected"}` or `{"protectionLevel":"none"}` to toggle page protection
when the actor has `page.protect`. Protected pages require `page.protect` before server-side write
operations such as draft saving, publication, rollback, rename, delete, archive, or restore are
applied.

Backlinks return published, non-deleted source pages that link to the requested page through stored wiki-link relationships.

### Revisions

```http
GET /api/v1/revisions/{id}
GET /api/v1/revisions/{from}/diff/{to}
```

Revision reads return immutable stored revision data. Diff returns unified diff lines generated from the stored Markdown of both revisions.

### Search

```http
GET /api/v1/search?q=term&category=docs&page=1&pageSize=20
```

Search uses PostgreSQL full-text search over titles, aliases, rendered plain text, and category names.

### Categories

```http
GET /api/v1/categories
GET /api/v1/categories/{slug}
```

Category detail includes pages currently associated with the category.

### Media

```http
GET /api/v1/media?q=term&page=1&pageSize=50
POST /api/v1/media
GET /api/v1/media/{id}
DELETE /api/v1/media/{id}?force=false
```

Uploads use `multipart/form-data` with a required `file` part and optional `altText` of at most
2,000 characters. They are
rejected before buffering beyond the configured hard limit, validated using detected safe MIME
types, and stored through the configured media adapter. `GET /api/v1/media/{id}` lists content
references;
deletion is blocked while references exist unless an authorized caller explicitly sends
`force=true`. Media URLs remain same-origin so every private read passes through authorization;
non-inline-safe types are downloaded as attachments.

### Administration

```http
GET /api/v1/admin/users
PATCH /api/v1/admin/users/{id}
GET /api/v1/admin/groups
POST /api/v1/admin/groups
PATCH /api/v1/admin/groups/{id}
GET /api/v1/admin/roles
POST /api/v1/admin/roles
PATCH /api/v1/admin/roles/{id}
GET /api/v1/admin/audit
```

Admin endpoints require the corresponding server-side permission. User group membership edits, group creation, role assignment, custom role creation, and custom role permission updates are available through both JSON API routes and the server-rendered admin UI; other administrative mutation workflows remain server-action backed in v0.1.0.

`GET /api/v1/admin/audit` accepts `q`, `action`, `page`, and `pageSize` query parameters for permission-protected audit review.

## Operational Endpoints

```http
GET /api/health
GET /api/ready
```

Health returns application liveness. Readiness checks database and storage connectivity.
