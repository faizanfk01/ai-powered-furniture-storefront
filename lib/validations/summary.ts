import { z } from "zod";

import { SUMMARY_MAX_LENGTH, SUMMARY_MIN_LENGTH } from "../ai/summary";

/**
 * The body of PUT /api/admin/products/[id]/summary.
 *
 * WHY THIS EXISTS WHEN productUpdateSchema DELIBERATELY OMITS `aiSummary`.
 * That omission is right and stays: a caller must not be able to write
 * marketing copy into a field the storefront labels as machine-written, and
 * /api/products/[id] is the wrong door for it entirely.
 *
 * This is a different door, and a narrower one. It is admin-only, it does
 * nothing but set that single column, and — the part that carries the
 * guarantee — the handler re-runs checkSummaryGrounding() against the
 * product's own row before the write. Length is all this schema can judge;
 * whether the text is grounded is a question about the product, not about the
 * body, so it cannot be answered here.
 *
 * The result is that the shape of the trust is unchanged. The admin decides
 * WHETHER a summary is published. The product's own fields decide what it is
 * allowed to say. Nothing between the Generate button and the column can widen
 * that, including a hand-written curl.
 */
export const summarySaveSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(SUMMARY_MIN_LENGTH, "That is too short to be a summary")
    .max(
      SUMMARY_MAX_LENGTH,
      `A summary must be ${SUMMARY_MAX_LENGTH} characters or fewer`,
    ),
});

export type SummarySaveInput = z.infer<typeof summarySaveSchema>;
