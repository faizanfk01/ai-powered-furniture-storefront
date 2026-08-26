import { NextResponse } from "next/server";

import {
  handleApiError,
  notFound,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import { db } from "@/lib/db";
import { deleteProductObjects } from "@/lib/r2";
import { productInclude } from "@/lib/products";
import { productUpdateSchema } from "@/lib/validations";

// GET is public; PATCH and DELETE require an admin session. See the note in
// ../route.ts for why the guard is per method rather than in proxy.ts.

const NOT_FOUND_MESSAGE = "Product not found";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const { id } = await context.params;

  try {
    const product = await db.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) return notFound(NOT_FOUND_MESSAGE);

    return NextResponse.json(product);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = productUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const product = await db.product.update({
      where: { id },
      data: parsed.data,
      include: productInclude,
    });
    return NextResponse.json(product);
  } catch (error) {
    return handleApiError(error, {
      notFound: NOT_FOUND_MESSAGE,
      conflict: parsed.data.slug
        ? `A product with the slug "${parsed.data.slug}" already exists`
        : "That change conflicts with an existing product",
      missingReference: `Category "${parsed.data.categoryId}" does not exist`,
    });
  }
}

/**
 * DELETE /api/products/[id]
 *
 * Removes the product, its images and its reviews from the database, AND its
 * image files from R2.
 *
 * ORDER: the database commits FIRST, then the bucket is swept. That is the
 * opposite of the per-image DELETE in
 * /api/admin/products/[id]/images/[imageId], which deletes its row inside a
 * transaction and lets an R2 failure roll it back — and the difference is
 * deliberate, because deleting a product is not deleting one object:
 *
 *   - A rollback cannot un-delete a file. With N objects, R2 failing on the
 *     third of five would roll the database back to a product whose first two
 *     photographs no longer exist — a restored row pointing at deleted
 *     objects, which is the broken state we most want to avoid. The per-image
 *     endpoint has exactly one object, so it cannot half-succeed that way.
 *   - Holding a database transaction open across N network calls to another
 *     provider invites a transaction timeout on a slow link, turning a working
 *     delete into a failed one.
 *
 * Committing first makes the only residual failure a leftover file: the rows
 * are gone, so nothing points at anything missing, and the storefront is
 * correct either way. That is the safer of the two residuals — a file nobody
 * references costs storage; a row nobody can render costs a broken page.
 *
 * A sweep failure therefore does NOT fail the request. The product IS deleted;
 * answering 500 would tell the caller to retry something that already
 * happened. It is logged loudly instead, and the next delete of any product
 * sweeps the same prefix again.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  let product;
  try {
    // No `inUse` mapping: nothing Restricts a product. Its images and reviews
    // are onDelete: Cascade, so they go with it.
    product = await db.product.delete({ where: { id } });
  } catch (error) {
    return handleApiError(error, { notFound: NOT_FOUND_MESSAGE });
  }

  // Past this point the product is gone and the caller is getting a 200.
  try {
    const removed = await deleteProductObjects(product.id);
    if (removed > 0) {
      console.info(
        `[api] deleted ${removed} R2 object(s) for product ${product.id}`,
      );
    }
  } catch (error) {
    // The one outcome worth shouting about: the rows are gone but the files
    // are not, which is the exact leak this sweep exists to prevent.
    console.error(
      `[api] product ${product.id} was deleted but its R2 objects were not — ` +
        `orphaned under products/${product.id}/`,
      error,
    );
  }

  return NextResponse.json(product);
}
