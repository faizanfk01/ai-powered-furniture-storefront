import { z } from "zod";

import { idSchema, nonEmptyPatch, reviewStatusSchema } from "./common";

/**
 * Public submission shape. `status` is absent on purpose: every review starts
 * PENDING, set server-side. If the client could send it, anyone could publish
 * straight to the storefront by adding one field to the request body.
 */
export const reviewCreateSchema = z.object({
  authorName: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be 80 characters or fewer"),

  // Mirrors the DB `Review_rating_check` CHECK (rating BETWEEN 1 AND 5). That
  // constraint is the backstop; this is the guard that produces a message a
  // person can act on.
  rating: z
    .int("Rating must be a whole number")
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5"),

  body: z
    .string()
    .trim()
    .min(1, "Review text is required")
    .max(2000, "Review must be 2000 characters or fewer"),

  // Null or absent = a general store review rather than a product review.
  productId: idSchema.nullish(),
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

/**
 * Admin-only. Separate from the create schema rather than an optional field on
 * it, so there is no code path where a public handler can reach a status write.
 */
export const reviewModerationSchema = z.object({
  status: reviewStatusSchema,
});

export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;

/**
 * Admin-only edit of the review content itself — fixing a typo or trimming
 * abuse before approving. Includes `status` so one PATCH can edit and approve.
 */
export const reviewUpdateSchema = nonEmptyPatch(
  reviewCreateSchema.extend({ status: reviewStatusSchema }).partial(),
);

export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
