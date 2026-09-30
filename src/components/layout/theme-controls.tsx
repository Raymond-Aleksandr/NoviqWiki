"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/i18n";

type Appearance = "light" | "dark";
type Locale = "zh-CN" | "en";
type PreferenceMessages = Pick<
  Messages,
  "language" | "appearance" | "light" | "dark" | "simplifiedChinese" | "english"
>;

const appearanceCookie = "noviqwiki-appearance";
const localeCookie = "noviqwiki-locale";

function setCookie(name: string, value: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

export function PreferenceControls({
  initialAppearance,
  initialLocale,
  messages
}: {
  initialAppearance: Appearance;
  initialLocale: Locale;
  messages: PreferenceMessages;
}) {
  const router = useRouter();
  const [changingLocale, startTransition] = useTransition();
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    setAppearance(initialAppearance);
  }, [initialAppearance]);

  useEffect(() => {
    setLocale(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
  }, [appearance]);

  function chooseAppearance(next: Appearance) {
    setAppearance(next);
    setCookie(appearanceCookie, next);
  }

  function chooseLocale(next: Locale) {
    if (next === locale) return;
    setLocale(next);
    setCookie(localeCookie, next);
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  }

  return (
    <div className="preference-controls">
      <div className="segmented-control" role="group" aria-label={messages.language} aria-busy={changingLocale}>
        <button
          type="button"
          className={locale === "zh-CN" ? "active" : ""}
          aria-pressed={locale === "zh-CN"}
          aria-label={messages.simplifiedChinese}
          lang="zh-CN"
          disabled={changingLocale}
          onClick={() => chooseLocale("zh-CN")}
        >
          中文
        </button>
        <button
          type="button"
          className={locale === "en" ? "active" : ""}
          aria-pressed={locale === "en"}
          aria-label={messages.english}
          lang="en"
          disabled={changingLocale}
          onClick={() => chooseLocale("en")}
        >
          EN
        </button>
      </div>
      <div className="segmented-control" role="group" aria-label={messages.appearance}>
        <button
          type="button"
          className={appearance === "light" ? "active" : ""}
          aria-pressed={appearance === "light"}
          onClick={() => chooseAppearance("light")}
        >
          {messages.light}
        </button>
        <button
          type="button"
          className={appearance === "dark" ? "active" : ""}
          aria-pressed={appearance === "dark"}
          onClick={() => chooseAppearance("dark")}
        >
          {messages.dark}
        </button>
      </div>
    </div>
  );
}
