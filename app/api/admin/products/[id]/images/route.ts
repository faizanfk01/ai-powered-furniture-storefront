import { NextResponse } from "next/server";

import {
  apiError,
  handleApiError,
  notFound,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import { db } from "@/lib/db";
import { imageObjectExists, isImageKeyFor, publicUrl } from "@/lib/r2";
import { productImageCreateSchema } from "@/lib/validations";

// ADMIN — guarded by the proxy.ts path matcher and by requireAdmin() here;
// see the note in ./presign/route.ts for why both.

/**
 * POST /api/admin/products/[id]/images
 *
 * Body: { key, alt?, sortOrder? }   (a `url` field is ignored — see below)
 * 201:  the created ProductImage row
 *
 * The second half of the upload: presign issued the URL, the browser PUT the
 * bytes, this records the row that makes the object part of the product.
 *
 * The url is derived from the key rather than taken from the body. The client
 * has one — presign returned it — but storing what it sends back would let the
 * two fields disagree, and a row whose `url` renders one object while its
 * `key` deletes another is a bug with no compensating benefit. Deriving makes
 * that state unrepresentable. An extra `url` in the body is simply dropped by
 * the schema, so a client that echoes the whole presign response is fine.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/products/[id]/images">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = productImageCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  const { key, alt, sortOrder } = parsed.data;

  try {
    const product = await db.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) return notFound(`Product "${id}" does not exist`);

    // The key came back from the client, so it is an input again, not a value
    // we issued. Two checks, in cheapest-first order.

    // 1. Shape: is this a key we would have issued, for THIS product? Without
    //    it, a caller could attach an object living under another product's
    //    prefix — and then deleting this row would delete that product's file.
    if (!isImageKeyFor(product.id, key)) {
      return apiError(
        400,
        "VALIDATION_FAILED",
        "Key is not a valid upload key for this product. Request one from the presign endpoint.",
      );
    }

    // 2. Existence: did the upload actually land? A row for an object that was
    //    never uploaded is a broken <img> on the storefront that nothing will
    //    ever repair on its own.
    if (!(await imageObjectExists(key))) {
      return apiError(
        400,
        "VALIDATION_FAILED",
        "No uploaded object found for that key. Complete the upload to R2 before confirming it.",
      );
    }

    // Absent sortOrder means "last". Read-then-write, so two uploads confirmed
    // at the same instant could land on the same position — harmless (the
    // gallery order between those two is then unspecified, not broken) and not
    // worth a lock for a single-admin store.
    const position =
      sortOrder ??
      ((
        await db.productImage.aggregate({
          where: { productId: product.id },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) + 1;

    const image = await db.productImage.create({
      data: {
        productId: product.id,
        key,
        url: publicUrl(key),
        alt,
        sortOrder: position,
      },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    return handleApiError(error, {
      // The unique index on `key` — the same object confirmed twice, e.g. a
      // double-clicked confirm or a retried request.
      conflict: "That image has already been added to a product",
      missingReference: `Product "${id}" does not exist`,
    });
  }
}
