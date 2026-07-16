import { cookies } from "next/headers";
import { getMessages, type Locale } from "@/i18n";

export async function getRequestLocale(defaultLocale?: string | null): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("noviqwiki-locale")?.value;
  if (cookieLocale === "zh-CN" || cookieLocale === "en") {
    return cookieLocale;
  }
  return defaultLocale === "zh-CN" ? "zh-CN" : "en";
}

export async function getRequestI18n(defaultLocale?: string | null) {
  const locale = await getRequestLocale(defaultLocale);
  return { locale, messages: getMessages(locale) };
}
