import { db } from "./db";
import { Prisma } from "./generated/prisma/client";
import { productInclude } from "./products";
import type { ProductSearchQuery } from "./validations";

/**
 * Catalogue filtering and trigram search, in one place.
 *
 * Extracted from app/api/products/search/route.ts so the /catalog page and the
 * search endpoint cannot answer the same question differently. Two
 * implementations of "find me a sofa" — one ranking by trigram similarity, one
 * doing a LIKE — is the kind of divergence nobody notices until a customer
 * reports that the site search and the catalogue disagree.
 *
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
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
export function filterWhere(query: ProductSearchQuery): Prisma.ProductWhereInput {
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
 * loaded through Prisma so the result is byte-for-byte the shape
 * GET /api/products returns, without re-implementing the joins by hand.
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

export type SearchedProduct = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}> & { similarity?: number };

/**
 * The catalogue query: hard filters, optionally ranked by `q`.
 *
 * Called by the /catalog page directly (Server Component → db, no HTTP hop)
 * and by the search route.
 */
export async function searchProducts(
  query: ProductSearchQuery,
): Promise<SearchedProduct[]> {
  // No q: the filters alone define the result. Cheapest first, since price
  // is what a showroom customer narrows on; name breaks ties so that
  // paging through equal prices is stable.
  if (query.q === undefined) {
    return db.product.findMany({
      where: filterWhere(query),
      include: productInclude,
      orderBy: [{ price: "asc" }, { name: "asc" }],
      take: query.limit,
      skip: query.offset,
    });
  }

  const ranked = await rankedIds(query, query.q);
  if (ranked.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: ranked.map((row) => row.id) } },
    include: productInclude,
  });

  // `IN (...)` does not preserve order, so the ranking is reapplied here.
  const byId = new Map(products.map((product) => [product.id, product]));
  return ranked.flatMap((row) => {
    const product = byId.get(row.id);
    return product ? [{ ...product, similarity: row.similarity }] : [];
  });
}
