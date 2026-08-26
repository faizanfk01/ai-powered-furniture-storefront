import { NextResponse } from "next/server";

import {
  handleApiError,
  notFound,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import { db } from "@/lib/db";
import { buildImageKey, presignImageUpload, publicUrl } from "@/lib/r2";
import { imagePresignSchema } from "@/lib/validations";

// ---------------------------------------------------------------------------
// ADMIN. Guarded twice, on purpose.
//
// proxy.ts already blocks unauthenticated requests to /api/admin/:path* before
// this file runs, and that is the primary guard. requireAdmin() is here anyway
// because this handler mints a credential: a URL that lets whoever holds it
// write to our bucket. The proxy's protection lives in a matcher array in
// another file, where a future edit could drop this path without any diff in
// this one showing that upload access just became public. One line in the
// handler keeps the guarantee visible where the risk is, and costs a JWT
// verification with no database round trip.
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/products/[id]/images/presign
 *
 * Body:  { contentType: "image/jpeg" | "image/png" | "image/webp",
 *          fileSize: <bytes, 1 … 5 MB> }
 * 200:   { uploadUrl, key, publicUrl, expiresIn }
 *
 * Issues a one-object upload URL; it does not record anything. The browser
 * PUTs to `uploadUrl`, then calls POST ../images with the returned `key` and
 * `publicUrl` to create the ProductImage row.
 *
 * Nothing is written here because nothing is known yet — an object that has
 * been authorised is not an object that exists. Creating the row up front
 * would leave a dead row (and a broken <img>) behind every upload that fails,
 * is cancelled, or is simply never started. The cost of the split is the
 * opposite failure: an object uploaded but never confirmed, which is an
 * unreferenced file in a bucket rather than a hole in the storefront.
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/admin/products/[id]/images/presign">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  // Rejects a disallowed content type and an oversized fileSize alike, with
  // the field-level messages from imagePresignSchema.
  const parsed = imagePresignSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  const { contentType, fileSize } = parsed.data;

  try {
    // Confirm the product before signing anything. Otherwise a typo in the URL
    // yields a perfectly valid URL to a key under a productId that does not
    // exist, and the upload succeeds into a directory nothing will ever read.
    const product = await db.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!product) return notFound(`Product "${id}" does not exist`);

    // product.id, not the raw `id` param — the key is built from a value that
    // came back out of the database.
    const key = buildImageKey(product.id, contentType);

    const { uploadUrl, expiresIn } = await presignImageUpload({
      key,
      contentType,
      contentLength: fileSize,
    });

    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl: publicUrl(key),
      // So the client can tell a stale URL from a rejected one when the PUT
      // comes back 403 several minutes later.
      expiresIn,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
