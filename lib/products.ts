import type { Prisma } from "./generated/prisma/client";

/**
 * The relations every product response carries, so a client never has to
 * special-case whether a product came from the list or the single read.
 *
 * Lives here rather than in the route files because Next validates the export
 * surface of `route.ts` — only handlers and segment config belong there.
 *
 * `aiSummary` is included in the response (it is a plain scalar) but is not
 * writable: productCreateSchema omits it, so a client-supplied value is
 * stripped before the data ever reaches Prisma.
 */
export const productInclude = {
  category: true,
  images: { orderBy: { sortOrder: "asc" } },
} as const satisfies Prisma.ProductInclude;
