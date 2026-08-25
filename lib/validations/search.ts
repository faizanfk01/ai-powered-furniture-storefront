import { z } from "zod";

import { idSchema, stockStatusSchema } from "./common";

/** Hard ceiling on page size — a caller asking for more is a 400, not a clamp. */
export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Query parameters for GET /api/products/search. Everything is optional; an
 * empty search is a valid search that returns the catalogue.
 *
 * Values arrive as strings, so the numeric fields coerce. `z.coerce.number()`
 * turns unparseable input into NaN, which the `.int()` check then rejects —
 * so `?priceMin=cheap` is a 400 rather than a silent 0.
 *
 * The route drops empty-string parameters before parsing, so `?q=` reads as
 * "no q" rather than failing the min-length check.
 */
export const productSearchQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .min(1, "q must not be empty")
      .max(120, "q must be 120 characters or fewer")
      .optional(),

    /** Category **id**, not slug — matches the id in every product payload. */
    categoryId: idSchema.optional(),

    priceMin: z.coerce
      .number()
      .int("priceMin must be a whole number of rupees")
      .min(0, "priceMin must not be negative")
      .optional(),

    priceMax: z.coerce
      .number()
      .int("priceMax must be a whole number of rupees")
      .min(0, "priceMax must not be negative")
      .optional(),

    stockStatus: stockStatusSchema.optional(),

    limit: z.coerce
      .number()
      .int("limit must be a whole number")
      .min(1, "limit must be at least 1")
      .max(MAX_SEARCH_LIMIT, `limit must be ${MAX_SEARCH_LIMIT} or fewer`)
      .default(DEFAULT_SEARCH_LIMIT),

    offset: z.coerce
      .number()
      .int("offset must be a whole number")
      .min(0, "offset must not be negative")
      .default(0),
  })
  .refine(
    (query) =>
      query.priceMin === undefined ||
      query.priceMax === undefined ||
      query.priceMin <= query.priceMax,
    {
      error: "priceMin must not be greater than priceMax",
      path: ["priceMin"],
    },
  );

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
