import { z } from "zod";
import { MAX_PAGE_EDIT_SUMMARY_LENGTH, MAX_PAGE_MARKDOWN_LENGTH } from "@/modules/pages/service";
import { MAX_PAGE_SLUG_LENGTH, pageTitleSchema } from "@/modules/pages/title";

const markdownSchema = z
  .string()
  .max(
    MAX_PAGE_MARKDOWN_LENGTH,
    `Markdown must be ${MAX_PAGE_MARKDOWN_LENGTH} characters or less.`
  );
const slugSchema = z.string().trim().max(MAX_PAGE_SLUG_LENGTH);
const editSummarySchema = z.string().max(MAX_PAGE_EDIT_SUMMARY_LENGTH);

export const apiUuidSchema = z.string().uuid();

export const createPageApiSchema = z
  .object({
    title: pageTitleSchema,
    slug: slugSchema.optional(),
    markdown: markdownSchema.default(""),
    editSummary: editSummarySchema.optional(),
    publish: z.boolean().default(false)
  })
  .strict();

export const patchPageApiSchema = z.union([
  z.object({ action: z.enum(["archive", "restore"]) }).strict(),
  z.object({ protectionLevel: z.enum(["none", "protected"]) }).strict(),
  z
    .object({
      title: pageTitleSchema,
      slug: slugSchema.optional()
    })
    .strict(),
  z
    .object({
      markdown: markdownSchema,
      editSummary: editSummarySchema.optional(),
      baseRevisionId: apiUuidSchema.nullable().optional()
    })
    .strict()
]);

export const listPagesApiQuerySchema = z
  .object({
    q: z.string().trim().max(500).optional(),
    status: z.enum(["draft", "published", "archived", "deleted"]).default("published"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50)
  })
  .strict();

export const rollbackPageApiSchema = z
  .object({
    targetRevisionId: apiUuidSchema,
    reason: z.string().max(MAX_PAGE_EDIT_SUMMARY_LENGTH).default("")
  })
  .strict();
