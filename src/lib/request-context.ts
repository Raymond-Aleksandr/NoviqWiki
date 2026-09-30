import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getPrimarySiteWithSettings } from "@/db/site";
import { getMessages } from "@/i18n";
import { resolveAppearance, resolveLocale } from "@/lib/preferences";
import { getCurrentSession } from "@/modules/auth/session";
import { hasPermission } from "@/modules/authorization/permissions";
import { getSetupState } from "@/modules/setup/service";

// React cache is scoped to the server render, never shared across users.
export const getRequestSite = cache(() => getPrimarySiteWithSettings());
export const getRequestSession = cache(() => getCurrentSession());
export const getRequestSetupState = cache(() => getSetupState());

export const getRequestPreferences = cache(async (defaultLocale?: string | null) => {
  const [cookieStore, headerStore, session, site] = await Promise.all([
    cookies(),
    headers(),
    getRequestSession().catch(() => null),
    defaultLocale == null ? getRequestSite().catch(() => null) : null
  ]);
  const locale = resolveLocale({
    cookieLocale: cookieStore.get("noviqwiki-locale")?.value,
    userLocale: session?.user.locale,
    acceptLanguage: headerStore.get("accept-language"),
    defaultLocale: defaultLocale ?? site?.settings?.defaultLocale
  });
  const appearance = resolveAppearance(
    cookieStore.get("noviqwiki-appearance")?.value,
    session?.user.appearance
  );
  return { locale, appearance, messages: getMessages(locale) };
});

export const getShellContext = cache(async () => {
  const [site, session, setup] = await Promise.all([
    getRequestSite().catch(() => null),
    getRequestSession().catch(() => null),
    getRequestSetupState().catch(() => null)
  ]);
  const [preferences, canAdmin] = await Promise.all([
    getRequestPreferences(site?.settings?.defaultLocale),
    site && session
      ? hasPermission(session.user.id, site.site.id, "site.configure").catch(() => false)
      : false
  ]);
  return {
    site,
    session,
    setupRequired: setup ? setup.mode !== "complete" : !site,
    canAdmin,
    ...preferences
  };
});
