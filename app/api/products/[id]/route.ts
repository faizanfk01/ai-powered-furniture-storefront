import { NextResponse } from "next/server";

import {
  handleApiError,
  notFound,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import { db } from "@/lib/db";
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

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/products/[id]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  try {
    // No `inUse` mapping: nothing Restricts a product. Its images and reviews
    // are onDelete: Cascade, so they go with it.
    const product = await db.product.delete({ where: { id } });
    return NextResponse.json(product);
  } catch (error) {
    return handleApiError(error, { notFound: NOT_FOUND_MESSAGE });
  }
}
