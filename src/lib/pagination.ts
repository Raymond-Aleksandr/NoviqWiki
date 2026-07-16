import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export function getPagination(searchParams: URLSearchParams) {
  const parsed = paginationSchema.parse(Object.fromEntries(searchParams.entries()));
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    offset: (parsed.page - 1) * parsed.pageSize,
    limit: parsed.pageSize
  };
}
