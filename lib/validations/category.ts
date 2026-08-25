import { z } from "zod";

import { nonEmptyPatch, slugSchema } from "./common";

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(60, "Name must be 60 characters or fewer"),
  slug: slugSchema,
});

export const categoryUpdateSchema = nonEmptyPatch(
  categoryCreateSchema.partial(),
);

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
