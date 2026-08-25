import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleApiError, readJson, validationFailed } from "@/lib/api";
import { db } from "@/lib/db";
import { reviewCreateSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// PUBLIC. These two handlers stay reachable without auth after Phase 2.5.
// Anything that can read or write a PENDING review lives under /api/admin.
// ---------------------------------------------------------------------------

/**
 * GET /api/reviews            → approved general store reviews
 * GET /api/reviews?productId= → approved reviews for that product
 *
 * The two shapes map to the two places reviews are shown: the storefront's
 * testimonials and a product page. There is deliberately no "all approved
 * reviews" mode — nothing in the UI needs it, and not having it means the
 * `status: APPROVED` filter below is unconditional rather than something a
 * future query parameter could widen.
 */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("productId");

  try {
    const reviews = await db.review.findMany({
      where: {
        status: "APPROVED",
        productId: productId ?? null,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reviews);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/reviews — public submission.
 *
 * Everything a visitor submits is unmoderated text, so it lands as PENDING
 * and stays invisible until an admin approves it through /api/admin/reviews.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return body.response;

  // reviewCreateSchema has no `status` field, so a client-supplied one is
  // stripped here rather than rejected — and the literal below is the only
  // value this route can ever write.
  const parsed = reviewCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const review = await db.review.create({
      data: {
        ...parsed.data,
        productId: parsed.data.productId ?? null,
        status: "PENDING",
      },
    });
    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    // A null productId is a general store review and never reaches the FK.
    return handleApiError(error, {
      missingReference: `Product "${parsed.data.productId}" does not exist`,
    });
  }
}
