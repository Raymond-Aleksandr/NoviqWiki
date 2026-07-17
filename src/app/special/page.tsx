import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  FileQuestion,
  FileText,
  GitBranch,
  ImageIcon,
  Link2Off,
  ListChecks,
  ListTree,
  RouteOff,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Shuffle,
  Tags,
  UserCog,
  UsersRound,
  Wrench
} from "lucide-react";
import { requirePageReadAccess } from "@/app/access";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getRequestI18n } from "@/i18n/server";
import { hasPermission } from "@/modules/authorization/permissions";
import { getSpecialPageSections, type SpecialPageIcon } from "@/modules/pages/special-pages";

const specialPageIcons: Record<SpecialPageIcon, typeof Search> = {
  activity: Activity,
  admin: ShieldCheck,
  audit: ListTree,
  categories: Tags,
  deadEnd: RouteOff,
  groups: UsersRound,
  media: ImageIcon,
  orphaned: Link2Off,
  pages: FileText,
  protected: ShieldCheck,
  random: Shuffle,
  redirects: GitBranch,
  roles: UserCog,
  search: Search,
  settings: Settings,
  short: Ruler,
  status: Wrench,
  uncategorized: Tags,
  users: UsersRound,
  wanted: FileQuestion
};

export default async function SpecialPages() {
  const site = await getPrimarySiteWithSettings();
  if (!site) {
    redirect("/setup");
  }
  const session = await requirePageReadAccess(site.site.id);
  const [canConfigureSite, i18n] = await Promise.all([
    hasPermission(session?.user.id, site.site.id, "site.configure"),
    getRequestI18n(site.settings?.defaultLocale)
  ]);
  const { messages } = i18n;
  const sections = getSpecialPageSections(messages, { includeAdmin: canConfigureSite });

  return (
    <section className="page-frame special-page">
      <nav className="breadcrumbs" aria-label={messages.breadcrumb}>
        <Link href="/">{messages.read}</Link>
        <span aria-hidden="true">/</span>
        <span>{messages.specialPages}</span>
      </nav>
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.specialPages}</h1>
          <p className="page-description">{messages.specialPagesDescription}</p>
        </div>
        <div className="page-header-actions">
          <Link className="button" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            {messages.read}
          </Link>
        </div>
      </header>
      <div className="special-page-grid">
        {sections.map((section) => (
          <section className="data-panel special-page-section" key={section.id}>
            <div className="admin-panel-heading special-page-heading">
              <span>
                <ListChecks size={16} aria-hidden="true" />
                {section.title}
              </span>
              <small>{section.description}</small>
            </div>
            <div className="special-link-list">
              {section.links.map((item) => {
                const Icon = specialPageIcons[item.icon];
                return (
                  <Link className="special-link-row" href={item.href} key={item.href}>
                    <span className="special-link-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span className="special-link-copy">
                      <strong>{item.title}</strong>
                      <small>{item.description}</small>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
