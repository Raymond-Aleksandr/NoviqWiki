import { redirect } from "next/navigation";
import { requirePageReadAccess } from "@/app/access";
import { getRequestSite } from "@/lib/request-context";
import { HomeView } from "@/features/discovery/home";
import { activityItem, extractFirstMarkdownImage } from "@/features/discovery/model";
import { getRequestI18n } from "@/i18n/server";
import { listCategories } from "@/modules/categories/service";
import { rewriteLegacyMediaUrls } from "@/modules/media/service";
import { getRevisionById, listPages, listPagesBySlugs } from "@/modules/pages/service";
import { listRecentChangesWithTargets } from "@/modules/activity/service";
import { collectHomepageContributions } from "@/modules/plugins/registry";
import { normalizeHomepageSections, prioritizeCategories } from "@/modules/settings/homepage";

export default async function HomePage() {
  const site = await getRequestSite();
  if (!site) {
    redirect("/setup");
  }
  await requirePageReadAccess(site.site.id);
  const settings = site.settings;
  const homepageSections = normalizeHomepageSections(settings?.homepageSections);
  const [recentPages, configuredPages, categories, changes] = await Promise.all([
    listPages({ siteId: site.site.id, status: "published", limit: 6 }),
    listPagesBySlugs({
      siteId: site.site.id,
      slugs: settings?.homepageFeaturedPages ?? [],
      limit: 6
    }),
    listCategories(site.site.id),
    listRecentChangesWithTargets({ siteId: site.site.id, limit: 5, publicOnly: true })
  ]);
  const { locale, messages } = await getRequestI18n(settings?.defaultLocale);
  const featuredPages = (configuredPages.length > 0 ? configuredPages : recentPages).slice(0, 3);
  const featuredCoverByPageId = await getFeaturedCoverByPageId(site.site.id, featuredPages);
  const featuredCategories = prioritizeCategories(
    categories,
    settings?.homepageFeaturedCategories ?? []
  ).slice(0, 8);
  const pluginContributions = collectHomepageContributions({ siteId: site.site.id, locale });
  return (
    <HomeView
      title={settings?.homepageTitle ?? site.site.name}
      logoUrl={settings?.logoUrl}
      intro={settings?.homepageIntro ?? settings?.tagline}
      sections={homepageSections}
      featuredPages={featuredPages.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        cover: featuredCoverByPageId.get(page.id)
      }))}
      categories={featuredCategories}
      activity={changes.map((change) => activityItem(change, locale, messages))}
      contributions={pluginContributions}
      messages={messages}
    />
  );
}

async function getFeaturedCoverByPageId(
  siteId: string,
  featuredPages: readonly { id: string; currentRevisionId: string | null }[]
) {
  const entries = await Promise.all(
    featuredPages.map(async (page) => {
      if (!page.currentRevisionId) {
        return [page.id, null] as const;
      }
      const revision = await getRevisionById(page.currentRevisionId).catch(() => null);
      return [page.id, revision?.markdown ?? null] as const;
    })
  );
  const markdownEntries = entries.filter(
    (entry): entry is readonly [string, string] => entry[1] !== null
  );
  const rewrittenMarkdown = await rewriteLegacyMediaUrls({
    siteId,
    contents: markdownEntries.map(([, markdown]) => markdown)
  });
  return new Map(
    markdownEntries.flatMap(([pageId], index) => {
      const cover = extractFirstMarkdownImage(rewrittenMarkdown[index] ?? "");
      return cover ? ([[pageId, cover]] as const) : [];
    })
  );
}
