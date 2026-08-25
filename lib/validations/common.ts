import { z } from "zod";

import {
  ReviewStatus as PrismaReviewStatus,
  StockStatus as PrismaStockStatus,
} from "../generated/prisma/enums";

// ---------------------------------------------------------------------------
// Enums — derived from Prisma, not re-typed
// ---------------------------------------------------------------------------
//
// These are built directly from the Prisma-generated enum objects rather than
// from a hand-written list of strings, so there is only one definition of the
// allowed values and drift is structurally impossible: change the enum in
// schema.prisma, run `prisma generate`, and these follow.

export const stockStatusSchema = z.enum(PrismaStockStatus);
export const reviewStatusSchema = z.enum(PrismaReviewStatus);

// Compile-time guard. Deriving from the Prisma object already keeps the values
// in sync, but this catches the regression where someone "simplifies" the lines
// above into a literal array (z.enum(["IN_STOCK", ...])) and then adds a member
// to schema.prisma without updating it. On any mismatch `Equals` resolves to
// `never`, `true satisfies never` fails, and `tsc --noEmit` breaks here with
// the two sets side by side. Type-level only — nothing is emitted.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

true satisfies Equals<z.infer<typeof stockStatusSchema>, PrismaStockStatus>;
true satisfies Equals<z.infer<typeof reviewStatusSchema>, PrismaReviewStatus>;

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

/**
 * URL-safe slug: lowercase alphanumerics separated by single hyphens.
 *
 * Deliberately stricter than "letters, numbers and hyphens": no leading,
 * trailing or doubled hyphens, so a slug has exactly one canonical form and
 * `/products/sofa--x-` can't exist alongside `/products/sofa-x`.
 *
 * Also deliberately does NOT lowercase for you. A slug is an identifier that
 * ends up in a URL; silently rewriting what the admin typed makes the row they
 * get back differ from the one they submitted.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(96, "Slug must be 96 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must be lowercase letters, numbers and single hyphens (e.g. karachi-3-seater-sofa)",
  );

/** A cuid from Prisma. Kept loose — cuid vs cuid2 is Prisma's business. */
export const idSchema = z.string().trim().min(1, "Id is required").max(64);

/**
 * PATCH bodies are partial by definition, but an empty object is not a valid
 * partial update — it would reach Prisma as `update({ data: {} })`, a silent
 * no-op that returns 200 and tells the caller nothing went wrong.
 */
export function nonEmptyPatch<T extends z.ZodObject>(schema: T) {
  return schema.refine((value) => Object.keys(value).length > 0, {
    error: "Provide at least one field to update",
  });
}
