"use client";

import { useEffect, useState } from "react";

type Appearance = "light" | "dark";
type Locale = "zh-CN" | "en";

const appearanceCookie = "noviqwiki-appearance";
const localeCookie = "noviqwiki-locale";

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
}

export function PreferenceControls({
  initialAppearance,
  initialLocale
}: {
  initialAppearance: Appearance;
  initialLocale: Locale;
}) {
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
  }, [appearance]);

  function chooseAppearance(next: Appearance) {
    setAppearance(next);
    setCookie(appearanceCookie, next);
  }

  function chooseLocale(next: Locale) {
    setLocale(next);
    setCookie(localeCookie, next);
    window.location.reload();
  }

  return (
    <div className="preference-controls">
      <div className="segmented-control" aria-label="Language">
        <button
          type="button"
          className={locale === "zh-CN" ? "active" : ""}
          aria-pressed={locale === "zh-CN"}
          onClick={() => chooseLocale("zh-CN")}
        >
          中文
        </button>
        <button
          type="button"
          className={locale === "en" ? "active" : ""}
          aria-pressed={locale === "en"}
          onClick={() => chooseLocale("en")}
        >
          EN
        </button>
      </div>
      <div className="segmented-control" aria-label="Appearance">
        <button
          type="button"
          className={appearance === "light" ? "active" : ""}
          aria-pressed={appearance === "light"}
          onClick={() => chooseAppearance("light")}
        >
          Light
        </button>
        <button
          type="button"
          className={appearance === "dark" ? "active" : ""}
          aria-pressed={appearance === "dark"}
          onClick={() => chooseAppearance("dark")}
        >
          Dark
        </button>
      </div>
    </div>
  );
}
