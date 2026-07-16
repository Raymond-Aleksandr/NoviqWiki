import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="admin-tabs" aria-label="Admin navigation">
      <Link className="button" href="/admin">
        Dashboard
      </Link>
      <Link className="button" href="/admin/pages">
        Pages
      </Link>
      <Link className="button" href="/admin/users">
        Users
      </Link>
      <Link className="button" href="/admin/groups">
        Groups
      </Link>
      <Link className="button" href="/admin/roles">
        Roles
      </Link>
      <Link className="button" href="/admin/media">
        Media
      </Link>
      <Link className="button" href="/admin/settings">
        Settings
      </Link>
      <Link className="button" href="/admin/audit">
        Audit
      </Link>
      <Link className="button" href="/admin/status">
        Status
      </Link>
    </nav>
  );
}
