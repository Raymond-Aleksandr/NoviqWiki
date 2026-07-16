export type HomepageLayout = "classic" | "portal" | "compact";

export type HomepageSectionsInput = {
  search?: boolean | null;
  featured?: boolean | null;
  recent?: boolean | null;
  categories?: boolean | null;
  layout?: string | null;
  showLogo?: boolean | null;
} | null;

export type NormalizedHomepageSections = {
  search: boolean;
  featured: boolean;
  recent: boolean;
  categories: boolean;
  layout: HomepageLayout;
  showLogo: boolean;
};

export function normalizeHomepageSections(
  sections?: HomepageSectionsInput
): NormalizedHomepageSections {
  return {
    search: homepageFlag(sections?.search, true),
    featured: homepageFlag(sections?.featured, true),
    recent: homepageFlag(sections?.recent, true),
    categories: homepageFlag(sections?.categories, true),
    layout: normalizeHomepageLayout(sections?.layout),
    showLogo: homepageFlag(sections?.showLogo, true)
  };
}

export function prioritizeCategories<
  TCategory extends {
    slug: string;
  }
>(categories: TCategory[], configuredSlugs: string[]) {
  const normalized = Array.from(
    new Set(configuredSlugs.map((slug) => slug.trim()).filter(Boolean))
  );
  if (normalized.length === 0) {
    return categories;
  }
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const configured = normalized
    .map((slug) => bySlug.get(slug))
    .filter((category): category is TCategory => Boolean(category));
  const configuredSet = new Set(configured.map((category) => category.slug));
  return [...configured, ...categories.filter((category) => !configuredSet.has(category.slug))];
}

function homepageFlag(value: boolean | null | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeHomepageLayout(value: string | null | undefined): HomepageLayout {
  if (value === "portal" || value === "compact") {
    return value;
  }
  return "classic";
}
