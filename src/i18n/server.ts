import { cookies, headers } from "next/headers";
import { getMessages, type Locale } from "@/i18n";
import { getCurrentSession } from "@/modules/auth/session";

export async function getRequestLocale(defaultLocale?: string | null): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("noviqwiki-locale")?.value;
  if (cookieLocale === "zh-CN" || cookieLocale === "en") {
    return cookieLocale;
  }
  const session = await getCurrentSession().catch(() => null);
  if (session?.user.locale === "zh-CN" || session?.user.locale === "en") {
    return session.user.locale;
  }
  const headerStore = await headers();
  const acceptedLanguage = headerStore.get("accept-language") ?? "";
  if (acceptedLanguage.toLowerCase().includes("zh")) {
    return "zh-CN";
  }
  return defaultLocale === "zh-CN" ? "zh-CN" : "en";
}

export async function getRequestI18n(defaultLocale?: string | null) {
  const locale = await getRequestLocale(defaultLocale);
  return { locale, messages: getMessages(locale) };
}
