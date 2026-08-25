import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { handleApiError, validationFailed } from "@/lib/api";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { productInclude } from "@/lib/products";
import {
  productSearchQuerySchema,
  type ProductSearchQuery,
} from "@/lib/validations";

// Read-only. Public — this is the catalogue browse/search the storefront and
// the Phase 3 AI layer both call. No mutations here.
//
// Static segment, so Next matches /api/products/search before /api/products/[id].

/**
 * Score = word_similarity(q, name) + similarity(description, q)
 *
 * The two columns use different pg_trgm functions because they are different
 * shapes, and the choice was measured against the seeded catalogue rather
 * than assumed:
 *
 *   - NAME uses `word_similarity`, which scores the query against the best
 *     matching word-extent rather than the whole string. Plain `similarity()`
 *     is length-normalised over the entire name, so "sofa" against "Karachi
 *     3-Seater Fabric Sofa" scored only 0.179 — too weak to rank with.
 *     `word_similarity` finds the word "Sofa" and returns 1.000, against a
 *     next-best of 0.400 for everything else.
 *
 *   - DESCRIPTION uses plain `similarity`, deliberately NOT `word_similarity`.
 *     On a 300-character description `word_similarity` finds a flattering
 *     extent for almost any input: the nonsense query "xyznomatch" scored up
 *     to 0.273 against real descriptions, which is indistinguishable from a
 *     genuine weak match. `similarity()` is normalised over the whole text,
 *     so the same nonsense peaks at 0.026.
 *
 * They are summed rather than combined with GREATEST. Because `similarity()`
 * over a long description is inherently small (~0.04 at best here) while the
 * name term spans the full 0..1, the name dominates ranking and the
 * description acts as a tie-breaker that lifts products whose text genuinely
 * discusses the query. A score >= 1.0 means the query appeared as a word in
 * the product name — a legible signal for the Phase 3 AI layer.
 *
 * KNOWN LIMIT: a term that appears only in a description does not reliably
 * outrank name-trigram noise. "hydraulic" appears in exactly one description
 * and that product places third. Amplifying the description term fixes that
 * case but amplifies its noise by the same factor — at a 5x weight the
 * nonsense query "xyznomatch" scores 0.132 and stops returning empty, which
 * is a worse failure. Making description-only matches rank properly needs a
 * real lexical index (tsvector/websearch_to_tsquery) alongside the trigram
 * score, not a bigger multiplier.
 */

/**
 * Below this, a score is noise rather than a weak match.
 *
 * `q` ranks, it does not filter: a typo like "sofaa" still scores 0.667 on
 * name and stays far clear of this floor, and genuinely weak matches sink
 * rather than vanish. But a query sharing nothing with the catalogue must
 * return an empty result instead of all ten products in arbitrary order.
 * Measured: "xyznomatch" tops out at 0.026, real matches start around 0.143.
 */
const MIN_SIMILARITY = 0.05;

const SEARCH_PARAM_KEYS = [
  "q",
  "categoryId",
  "priceMin",
  "priceMax",
  "stockStatus",
  "limit",
  "offset",
] as const;

/**
 * Hard filters, as parameterised SQL fragments.
 *
 * Every value is interpolated through a Prisma tagged template, so it leaves
 * as a bind parameter and never as SQL text. Nothing here is concatenated.
 */
function filterConditions(query: ProductSearchQuery): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (query.categoryId !== undefined) {
    conditions.push(Prisma.sql`"categoryId" = ${query.categoryId}`);
  }
  if (query.priceMin !== undefined) {
    conditions.push(Prisma.sql`"price" >= ${query.priceMin}`);
  }
  if (query.priceMax !== undefined) {
    conditions.push(Prisma.sql`"price" <= ${query.priceMax}`);
  }
  if (query.stockStatus !== undefined) {
    conditions.push(
      Prisma.sql`"stockStatus" = ${query.stockStatus}::"StockStatus"`,
    );
  }

  return conditions;
}

/** The same hard filters, for the Prisma query builder on the no-`q` path. */
function filterWhere(query: ProductSearchQuery): Prisma.ProductWhereInput {
  return {
    ...(query.categoryId !== undefined && { categoryId: query.categoryId }),
    ...(query.stockStatus !== undefined && { stockStatus: query.stockStatus }),
    ...((query.priceMin !== undefined || query.priceMax !== undefined) && {
      price: {
        ...(query.priceMin !== undefined && { gte: query.priceMin }),
        ...(query.priceMax !== undefined && { lte: query.priceMax }),
      },
    }),
  };
}

/**
 * Rank ids by trigram similarity under the hard filters.
 *
 * Only ids and scores come back from raw SQL; the rows themselves are then
 * loaded through Prisma so the response is byte-for-byte the shape GET
 * /api/products returns, without re-implementing the joins by hand.
 */
async function rankedIds(query: ProductSearchQuery, q: string) {
  const conditions = filterConditions(query);
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  // The score is aliased in a subquery because Postgres allows an output alias
  // in ORDER BY but not in WHERE, and the floor has to be applied to it.
  return db.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT "id", "similarity"
    FROM (
      SELECT
        "id",
        "name",
        word_similarity(${q}, "name")
          + similarity("description", ${q}) AS "similarity"
      FROM "Product"
      ${where}
    ) AS ranked
    WHERE "similarity" > ${MIN_SIMILARITY}
    ORDER BY "similarity" DESC, "name" ASC
    LIMIT ${query.limit} OFFSET ${query.offset}
  `;
}

export async function GET(request: NextRequest) {
  // Absent and empty parameters are both "not supplied": ?q= is not an error.
  const raw: Record<string, string> = {};
  for (const key of SEARCH_PARAM_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null && value.trim() !== "") raw[key] = value;
  }

  const parsed = productSearchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return validationFailed(parsed.error, "Invalid search parameters");
  }
  const query = parsed.data;

  try {
    // No q: the filters alone define the result. Cheapest first, since price
    // is what a showroom customer narrows on; name breaks ties so that
    // paging through equal prices is stable.
    if (query.q === undefined) {
      const products = await db.product.findMany({
        where: filterWhere(query),
        include: productInclude,
        orderBy: [{ price: "asc" }, { name: "asc" }],
        take: query.limit,
        skip: query.offset,
      });
      return NextResponse.json(products);
    }

    const ranked = await rankedIds(query, query.q);
    if (ranked.length === 0) return NextResponse.json([]);

    const products = await db.product.findMany({
      where: { id: { in: ranked.map((row) => row.id) } },
      include: productInclude,
    });

    // `IN (...)` does not preserve order, so the ranking is reapplied here.
    const byId = new Map(products.map((product) => [product.id, product]));
    const ordered = ranked.flatMap((row) => {
      const product = byId.get(row.id);
      return product ? [{ ...product, similarity: row.similarity }] : [];
    });

    return NextResponse.json(ordered);
  } catch (error) {
    return handleApiError(error);
  }
}
