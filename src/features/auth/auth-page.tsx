import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

type AuthLink = {
  href: string;
  label: string;
  icon?: ReactNode;
};

type Props = {
  title: string;
  description?: string;
  siteName?: string;
  illustration?: string;
  centered?: boolean;
  icon?: ReactNode;
  links: AuthLink[];
  linksIntro?: string;
  children: ReactNode;
  note?: ReactNode;
};

export function AuthPage({
  title,
  description,
  siteName,
  illustration,
  centered = false,
  icon,
  links,
  linksIntro,
  children,
  note
}: Props) {
  return (
    <section
      className={`${illustration ? "auth-page" : "auth-compact"} auth-shell${centered ? " wide" : ""}`}
    >
      <div className={illustration ? "auth-card" : `auth-compact-card${centered ? " center" : ""}`}>
        <div className={illustration ? "auth-form-panel" : undefined}>
          {siteName ? (
            <div className="auth-brand">
              <span><BookOpen size={19} aria-hidden="true" /></span>
              <strong>{siteName}</strong>
            </div>
          ) : null}
          {icon ? <div className="verify-icon" aria-hidden="true">{icon}</div> : null}
          <PageHeader title={title} description={description} />
          {children}
          {linksIntro ? <p className="muted auth-secondary-link">{linksIntro}</p> : null}
          <nav className="auth-links">
            {links.map(({ href, label, icon: linkIcon }) => (
              <Link key={href} href={href}>{linkIcon}{label}</Link>
            ))}
          </nav>
          {note}
        </div>
        {illustration ? (
          <div className="auth-art" aria-hidden="true"><span>{illustration}</span></div>
        ) : null}
      </div>
    </section>
  );
}
