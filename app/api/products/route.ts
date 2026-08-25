import { NextResponse } from "next/server";

import {
  handleApiError,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import { db } from "@/lib/db";
import { productInclude } from "@/lib/products";
import { productCreateSchema } from "@/lib/validations";

// GET is public (the storefront reads it). Writes require an admin session —
// this path has no admin-only prefix for proxy.ts to match on, so the guard is
// per method, at the top of each mutating handler.

export async function GET() {
  try {
    const products = await db.product.findMany({
      include: productInclude,
      orderBy: { name: "asc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = productCreateSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const product = await db.product.create({
      data: parsed.data,
      include: productInclude,
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    // categoryId is checked by the foreign key rather than a lookup first —
    // a SELECT would still race a concurrent category delete.
    return handleApiError(error, {
      conflict: `A product with the slug "${parsed.data.slug}" already exists`,
      missingReference: `Category "${parsed.data.categoryId}" does not exist`,
    });
  }
}
