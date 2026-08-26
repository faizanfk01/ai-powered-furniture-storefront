import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleApiError, validationFailed } from "@/lib/api";
import { searchProducts } from "@/lib/product-search";
import { productSearchQuerySchema } from "@/lib/validations";

// Read-only. Public — this is the catalogue browse/search the storefront and
// the Phase 3 AI layer both call. No mutations here.
//
// Static segment, so Next matches /api/products/search before /api/products/[id].
//
// The ranking itself lives in lib/product-search.ts, because the /catalog page
// runs the same query directly against the database rather than over HTTP.
// Keeping the SQL here would have meant two implementations of the same
// search, free to drift apart.

export async function GET(request: NextRequest) {
  // Absent and empty parameters are both "not supplied": ?q= is not an error.
  const raw: Record<string, string> = {};
  for (const key of [
    "q",
    "categoryId",
    "priceMin",
    "priceMax",
    "stockStatus",
    "limit",
    "offset",
  ] as const) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null && value.trim() !== "") raw[key] = value;
  }

  const parsed = productSearchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return validationFailed(parsed.error, "Invalid search parameters");
  }

  try {
    return NextResponse.json(await searchProducts(parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
