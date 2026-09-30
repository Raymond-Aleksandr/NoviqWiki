import Link from "next/link";
import {
  Activity, FileQuestion, FileText, GitBranch, ImageIcon, Link2Off, ListChecks, ListTree,
  RouteOff, Ruler, Search, Settings, ShieldCheck, Shuffle, Star, Tags, UserCog, UsersRound, Wrench
} from "lucide-react";
import type { Messages } from "@/i18n";
import type { SpecialPageIcon, SpecialPageSection } from "@/modules/pages/special-pages";
import { ReportFrame } from "./reports";

const specialPageIcons = {
  activity: Activity, admin: ShieldCheck, audit: ListTree, categories: Tags, deadEnd: RouteOff,
  groups: UsersRound, media: ImageIcon, orphaned: Link2Off, pages: FileText, protected: ShieldCheck,
  random: Shuffle, redirects: GitBranch, roles: UserCog, search: Search, settings: Settings,
  short: Ruler, status: Wrench, uncategorized: Tags, users: UsersRound, wanted: FileQuestion, watchlist: Star
} satisfies Record<SpecialPageIcon, typeof Search>;

export function SpecialPagesView({ sections, messages }: {
  sections: readonly SpecialPageSection[];
  messages: Pick<Messages, "breadcrumb" | "read" | "specialPages" | "specialPagesDescription">;
}) {
  return (
    <ReportFrame title={messages.specialPages} description={messages.specialPagesDescription}
      messages={messages} className="special-page">
      <div className="special-page-grid">
        {sections.map((section) => (
          <section className="data-panel special-page-section" key={section.id}>
            <div className="admin-panel-heading special-page-heading">
              <span><ListChecks size={16} aria-hidden="true" />{section.title}</span>
              <small>{section.description}</small>
            </div>
            <div className="special-link-list">
              {section.links.map((item) => {
                const Icon = specialPageIcons[item.icon];
                return <Link className="special-link-row" href={item.href} key={item.href}>
                  <span className="special-link-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="special-link-copy"><strong>{item.title}</strong><small>{item.description}</small></span>
                </Link>;
              })}
            </div>
          </section>
        ))}
      </div>
    </ReportFrame>
  );
}
