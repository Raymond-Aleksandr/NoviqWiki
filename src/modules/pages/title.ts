import { z } from "zod";
import { normalizeTitle, slugifyTitle } from "@/lib/normalize";

export const pageTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(220, "Title must be 220 characters or less.")
  .refine((value) => !/[<>[\]{}|#]/.test(value), "Title contains unsupported characters.");

export const MAX_PAGE_SLUG_LENGTH = 240;
export const pageSlugSchema = z
  .string()
  .min(1, "Slug is required.")
  .max(MAX_PAGE_SLUG_LENGTH, `Slug must be ${MAX_PAGE_SLUG_LENGTH} characters or less.`);

export function derivePageIdentity(title: string, slug?: string) {
  const validTitle = pageTitleSchema.parse(title);
  const normalizedTitle = normalizeTitle(validTitle);
  const derivedSlug = pageSlugSchema.parse(
    slug?.trim() ? slugifyTitle(slug) : slugifyTitle(validTitle)
  );
  return {
    title: validTitle,
    normalizedTitle,
    slug: derivedSlug
  };
}
