import type { Locale } from "@/i18n";
import { getRequestPreferences } from "@/lib/request-context";

export async function getRequestLocale(defaultLocale?: string | null): Promise<Locale> {
  return (await getRequestPreferences(defaultLocale)).locale;
}

export async function getRequestI18n(defaultLocale?: string | null) {
  const { locale, messages } = await getRequestPreferences(defaultLocale);
  return { locale, messages };
}
