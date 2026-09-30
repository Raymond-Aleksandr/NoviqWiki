import { slugifyTitle } from "@/lib/normalize";

export type RedirectDirective = {
  targetTitle: string;
  targetSlug: string;
};

const redirectPattern =
  /^\s*#(?:redirect|重定向)\s*\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]*)?\]\]\s*$/i;

export function parseRedirectDirective(markdown: string): RedirectDirective | null {
  const firstContentLine = markdown
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0);
  if (!firstContentLine) {
    return null;
  }
  const targetTitle = firstContentLine.match(redirectPattern)?.[1]?.trim();
  if (!targetTitle) {
    return null;
  }
  return {
    targetTitle,
    targetSlug: slugifyTitle(targetTitle)
  };
}
