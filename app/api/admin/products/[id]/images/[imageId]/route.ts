import { NextResponse } from "next/server";

import { handleApiError, notFound, requireAdmin } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteImageObject } from "@/lib/r2";

// ADMIN — guarded by the proxy.ts path matcher and by requireAdmin() here;
// see the note in ../presign/route.ts for why both.

/**
 * DELETE /api/admin/products/[id]/images/[imageId]
 *
 * Removes the row and the object together. A stored image is two things in two
 * systems, and there is no way to change both atomically, so the question is
 * only which inconsistency to risk if the second half fails.
 *
 * ORDER: the row is deleted inside a transaction, then the object; a failure
 * from R2 throws before the commit and rolls the row back. Both survive, the
 * caller gets a 500, and a retry does the same thing again — the two systems
 * still agree.
 *
 * The alternative — delete the object first, or commit the row delete and then
 * try R2 — leaves a row pointing at a file that is gone, which is a broken
 * image on the public storefront. Cleanup of that requires knowing it
 * happened; this ordering doesn't.
 *
 * The residual window is a commit that fails after R2 has already accepted the
 * delete, which orphans a row rather than a file. Narrow, and it is the same
 * repair either way: delete the row again.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/products/[id]/images/[imageId]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, imageId } = await context.params;

  try {
    const image = await db.$transaction(async (tx) => {
      // productId in the filter, not just the id: /products/A/images/<B's
      // image> must be a 404, not a successful delete of B's photo. Without
      // it the product segment would be decorative.
      const row = await tx.productImage.findFirst({
        where: { id: imageId, productId: id },
      });
      if (!row) return null;

      await tx.productImage.delete({ where: { id: row.id } });

      // Throwing here rolls the delete above back — see the note on ordering.
      await deleteImageObject(row.key);

      return row;
    });

    if (!image) return notFound("Image not found");

    return NextResponse.json(image);
  } catch (error) {
    return handleApiError(error, { notFound: "Image not found" });
  }
}
