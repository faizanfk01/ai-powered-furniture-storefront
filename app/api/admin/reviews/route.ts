import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleApiError, validationFailed } from "@/lib/api";
import { db } from "@/lib/db";
import { reviewStatusSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// ADMIN. Everything under /api/admin/ is to be protected in Phase 2.5 by a
// single path-prefix guard rather than per-route checks.
//
// UNPROTECTED TODAY — local development only, do not deploy.
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/reviews?status=PENDING|APPROVED — the moderation queue.
 *
 * Defaults to PENDING: opening the queue should show the work waiting to be
 * done. This is the only route that returns unapproved review text.
 */
export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get("status");

  const status = statusParam
    ? reviewStatusSchema.safeParse(statusParam)
    : ({ success: true, data: "PENDING" } as const);

  if (!status.success) {
    return validationFailed(status.error, "Invalid `status` query parameter");
  }

  try {
    const reviews = await db.review.findMany({
      where: { status: status.data },
      // The moderator is judging text about a specific item, so the item comes
      // with it — otherwise every row needs a second lookup to be actionable.
      include: { product: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reviews);
  } catch (error) {
    return handleApiError(error);
  }
}
