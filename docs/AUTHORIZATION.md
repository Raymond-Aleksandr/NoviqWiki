# NoviqWiki Authorization

NoviqWiki authorization is enforced on the server. Client-side checks may improve the interface, but they are never the source of truth for privileged operations.

## Authentication Model

Users authenticate with an email/password account. Passwords are hashed with Argon2 before storage. The application stores only password hashes, never plaintext passwords.

Authenticated requests are associated with a server-validated session. Session cookies must be `HttpOnly`, `SameSite=Lax` or stricter, and `Secure` in production.

## RBAC Model

v0.1.0 uses role-based access control with users, groups, roles, and permissions. The setup wizard creates the first `Owner`; after setup, Owners can invite or create additional users and assign roles.

Default product roles:

| Role            | Purpose                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `Owner`         | Full control over setup, settings, users, groups, roles, permissions, backups, and destructive actions. |
| `Administrator` | Can manage site administration, content, media, users, groups, roles, audit logs, and backups.          |
| `Moderator`     | Can manage protected content, rollback, rename, delete, restore, and media moderation.                  |
| `Editor`        | Can create, edit, publish, and review revisions.                                                        |
| `Contributor`   | Can create pages, save drafts, edit allowed pages, and upload media.                                    |
| `Reader`        | Can read content allowed by site and page permissions.                                                  |

Deployments may allow anonymous reads for public wikis. Anonymous users have no write permissions.

## Permission Matrix

| Action                          | Anonymous           | Reader | Contributor | Editor | Moderator | Administrator | Owner |
| ------------------------------- | ------------------- | ------ | ----------- | ------ | --------- | ------------- | ----- |
| Read public pages               | Yes, if public wiki | Yes    | Yes         | Yes    | Yes       | Yes           | Yes   |
| Search public pages             | Yes, if public wiki | Yes    | Yes         | Yes    | Yes       | Yes           | Yes   |
| Create drafts                   | No                  | No     | Yes         | Yes    | Yes       | Yes           | Yes   |
| Publish pages                   | No                  | No     | No          | Yes    | Yes       | Yes           | Yes   |
| Edit pages                      | No                  | No     | Yes         | Yes    | Yes       | Yes           | Yes   |
| Upload media                    | No                  | No     | Yes         | Yes    | Yes       | Yes           | Yes   |
| View revision history           | No                  | Yes    | Yes         | Yes    | Yes       | Yes           | Yes   |
| Roll back revisions             | No                  | No     | No          | Yes    | Yes       | Yes           | Yes   |
| Delete or archive pages         | No                  | No     | No          | No     | Yes       | Yes           | Yes   |
| Manage users, groups, and roles | No                  | No     | No          | No     | No        | Yes           | Yes   |
| Change site settings            | No                  | No     | No          | No     | No        | Yes           | Yes   |
| Run backup operations           | No                  | No     | No          | No     | No        | Yes           | Yes   |

## Enforcement Rules

- Route handlers and server actions validate input with Zod before calling domain services.
- Domain services must receive the current actor and enforce authorization before changing state or returning restricted data.
- React components must not query the database directly and must not bypass domain services.
- Privileged operations must fail closed when the actor is missing, inactive, or has an unknown role.
- Admin-only operations must be checked on the server even when the UI hides controls.

## Page Protection

Page-level restrictions can narrow access beyond the global role. A protected page may require editor or admin access for edits, or explicit membership for reads. Protection must be evaluated before returning page content, revision content, rendered HTML, or search excerpts.

## Revision Access

Revisions are immutable records. Users who can read a page may read the published revision. Users need editor or admin access to inspect full revision history, compare drafts, or restore a previous revision.

When a revision contains content that is later restricted, access to the revision must follow the current page restriction unless a stricter historical restriction applies.

## Upload Access

Media upload permissions follow edit permissions. Upload endpoints must validate:

- The actor can upload.
- The file size is within the configured media size limit.
- The detected MIME type is allowed.
- The upload target is associated with a page or another authorized content record.

Never trust a client-supplied file extension or MIME type alone.

## Audit Expectations

Production deployments should log privileged actions with:

- Actor user ID.
- Action name.
- Target resource ID.
- Timestamp.
- Request correlation ID when available.

Logs must not contain passwords, session tokens, raw cookies, or full content bodies.

## Operational Recovery

Keep at least two Owner accounts. If all Owners are locked out, recover by applying a controlled database update or running an approved bootstrap script in a maintenance window. Record the recovery action in operational notes.
