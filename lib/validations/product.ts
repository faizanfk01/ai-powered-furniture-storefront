import { z } from "zod";

import { idSchema, nonEmptyPatch, slugSchema, stockStatusSchema } from "./common";

/**
 * `aiSummary` is intentionally absent. It is generated server-side from Groq in
 * Phase 3 and cached on the row; accepting it here would let a caller write
 * arbitrary marketing copy into a field the UI presents as machine-written.
 * Adding it to this schema is the bug — not an omission to be fixed later.
 */
export const productCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(160, "Name must be 160 characters or fewer"),

  slug: slugSchema,

  categoryId: idSchema,

  // Whole rupees. PKR is not transacted in paisa here, so a decimal price is a
  // caller mistake rather than something to round.
  price: z
    .int("Price must be a whole number of rupees")
    .positive("Price must be greater than zero")
    .max(100_000_000, "Price is implausibly large"),

  // Nullable as well as optional: on a PATCH, `null` is how you clear a value
  // that was previously set. Empty string means the same thing and is folded
  // into null so the column never holds "".
  dimensions: z
    .string()
    .trim()
    .max(120, "Dimensions must be 120 characters or fewer")
    .nullish()
    .transform((value) => (value === "" ? null : value)),

  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description must be 5000 characters or fewer"),

  stockStatus: stockStatusSchema,
});

export const productUpdateSchema = nonEmptyPatch(productCreateSchema.partial());

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
