# NoviqWiki API

NoviqWiki v0.1.0 exposes versioned JSON endpoints under `/api/v1` for pages, revisions, search, categories, media, current user state, and administration reads. First-run setup, login, logout, registration, password reset, and email verification are implemented through Next.js server actions and pages rather than JSON endpoints.

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

Returns the current authenticated user or `null`.

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

The API delegates to the same page services as the server-rendered UI. `POST` and `PATCH` require page permissions and validate title, Markdown, summary, publish intent, and optimistic concurrency fields.

Backlinks return published, non-deleted source pages that link to the requested page through stored wiki-link relationships.

### Revisions

```http
GET /api/v1/revisions/{id}
GET /api/v1/revisions/{from}/diff/{to}
```

Revision reads return immutable stored revision data. Diff returns unified diff lines generated from the stored Markdown of both revisions.

### Search

```http
GET /api/v1/search?q=term&category=docs&limit=20&offset=0
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
GET /api/v1/media
POST /api/v1/media
DELETE /api/v1/media/{id}
```

Uploads are validated against configured size and MIME allowlists and stored through the configured media adapter.

### Administration

```http
GET /api/v1/admin/users
GET /api/v1/admin/groups
GET /api/v1/admin/roles
GET /api/v1/admin/audit
```

Admin endpoints require the corresponding server-side permission. Mutating administrative workflows are currently exposed through the server-rendered admin UI and server actions.

## Operational Endpoints

```http
GET /api/health
GET /api/ready
```

Health returns application liveness. Readiness checks database and storage connectivity.
