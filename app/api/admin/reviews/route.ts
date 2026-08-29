import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleApiError, requireAdmin, validationFailed } from "@/lib/api";
import { db } from "@/lib/db";
import { reviewStatusSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// ADMIN. Guarded twice, on purpose — the same belt-and-braces the presign and
// summary routes use.
//
// The `/api/admin/:path*` matcher in proxy.ts is the primary guard and already
// stops an unauthenticated request before these handlers run. requireAdmin()
// is here as the second layer because the matcher lives in an array in another
// file, where an edit could drop this prefix without a single line in this
// file changing to show that the moderation queue had just become public —
// and this is the only route in the app that returns unapproved review text.
//
// It costs a JWT verification with no database round trip.
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/reviews?status=PENDING|APPROVED — the moderation queue.
 *
 * Defaults to PENDING: opening the queue should show the work waiting to be
 * done. This is the only route that returns unapproved review text.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

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
