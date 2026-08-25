import { NextResponse } from "next/server";

import {
  handleApiError,
  notFound,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import { db } from "@/lib/db";
import { categoryUpdateSchema } from "@/lib/validations";

// GET is public; PATCH and DELETE require an admin session. See the note in
// ../../products/route.ts for why the guard is per method rather than in proxy.ts.

const NOT_FOUND_MESSAGE = "Category not found";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/categories/[id]">,
) {
  const { id } = await context.params;

  try {
    const category = await db.category.findUnique({ where: { id } });
    if (!category) return notFound(NOT_FOUND_MESSAGE);

    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/categories/[id]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = categoryUpdateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const category = await db.category.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json(category);
  } catch (error) {
    // No existence check first: `update` on a missing row raises P2025, which
    // maps to the same 404 without the extra round trip or the race window.
    return handleApiError(error, {
      notFound: NOT_FOUND_MESSAGE,
      conflict: parsed.data.slug
        ? `A category with the slug "${parsed.data.slug}" already exists`
        : "That change conflicts with an existing category",
    });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/categories/[id]">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const category = await db.category.delete({ where: { id } });
    return NextResponse.json(category);
  } catch (error) {
    // Product.categoryId is onDelete: Restrict, so deleting a category that
    // still has products is refused by the database rather than silently
    // orphaning or cascading away the products.
    return handleApiError(error, {
      notFound: NOT_FOUND_MESSAGE,
      inUse: "Cannot delete a category that still has products",
    });
  }
}
