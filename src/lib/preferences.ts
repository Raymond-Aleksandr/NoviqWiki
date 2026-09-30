import type { Locale } from "@/i18n";

export type Appearance = "light" | "dark";

function supportedLocale(value?: string | null): Locale | undefined {
  return value === "en" || value === "zh-CN" ? value : undefined;
}

/** Resolve one language for both the document shell and its route content. */
export function resolveLocale({
  cookieLocale,
  userLocale,
  acceptLanguage,
  defaultLocale
}: {
  cookieLocale?: string | null;
  userLocale?: string | null;
  acceptLanguage?: string | null;
  defaultLocale?: string | null;
}): Locale {
  const preference = supportedLocale(cookieLocale) ?? supportedLocale(userLocale);
  if (preference) return preference;

  const accepted = (acceptLanguage ?? "")
    .split(",")
    .map((entry, index) => {
      const [language, ...parameters] = entry.trim().toLowerCase().split(";");
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;
      return { language, quality, index };
    })
    .filter(({ quality }) => Number.isFinite(quality) && quality > 0 && quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const { language } of accepted) {
    if (language === "en" || language.startsWith("en-")) return "en";
    if (language === "zh" || language.startsWith("zh-")) return "zh-CN";
  }
  return supportedLocale(defaultLocale) ?? "en";
}

export function resolveAppearance(cookieAppearance?: string | null, userAppearance?: string | null): Appearance {
  const value = cookieAppearance === "light" || cookieAppearance === "dark"
    ? cookieAppearance
    : userAppearance;
  return value === "dark" ? "dark" : "light";
}
