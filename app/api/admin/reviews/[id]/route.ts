import { NextResponse } from "next/server";

import { handleApiError, readJson, validationFailed } from "@/lib/api";
import { db } from "@/lib/db";
import { reviewUpdateSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// ADMIN — see the note in ../route.ts. UNPROTECTED TODAY, local only.
// ---------------------------------------------------------------------------

const NOT_FOUND_MESSAGE = "Review not found";

/**
 * PATCH /api/admin/reviews/[id] — moderation.
 *
 * reviewUpdateSchema covers approve (status → APPROVED), unapprove
 * (→ PENDING) and content edits in one request, so fixing a typo and
 * approving is a single call rather than an edit followed by an approve that
 * could half-fail.
 */
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/reviews/[id]">,
) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = reviewUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const review = await db.review.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(review);
  } catch (error) {
    return handleApiError(error, {
      notFound: NOT_FOUND_MESSAGE,
      // The schema allows re-pointing a review at a different product.
      missingReference: `Product "${parsed.data.productId}" does not exist`,
    });
  }
}

/** DELETE /api/admin/reviews/[id] — remove spam or abuse outright. */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/reviews/[id]">,
) {
  const { id } = await context.params;

  try {
    const review = await db.review.delete({ where: { id } });
    return NextResponse.json(review);
  } catch (error) {
    return handleApiError(error, { notFound: NOT_FOUND_MESSAGE });
  }
}
