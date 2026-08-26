import { z } from "zod";

/**
 * The catalogue's filter state, which lives entirely in the URL.
 *
 * WHY THE URL AND NOT REACT STATE — the decision that shapes this whole page:
 *
 *   1. WhatsApp is this business's only conversion path (CLAUDE.md → Payments).
 *      "Here are the sofas under a lakh" has to survive being pasted into a
 *      chat. Filter state held in a component produces a link that opens the
 *      unfiltered catalogue for whoever receives it — the exact moment the
 *      site is being recommended is the moment it forgets what it was showing.
 *   2. The back button then works, for free.
 *   3. A category-filtered catalogue is a page Google can index.
 *   4. The filtering happens in Postgres, next to the indexes, instead of
 *      shipping every product to the browser to be filtered there. Ten
 *      products would be fine; a real catalogue would not.
 *   5. Search reuses the pg_trgm ranking in lib/product-search.ts, so "sofaa"
 *      still finds the sofas. No client-side filter can do that.
 *
 * The cost is a server round trip per change. That is paid down in the
 * controls: the text input is debounced, and navigation runs in a transition
 * so typing never blocks.
 */

/**
 * Price bands rather than a two-handle slider.
 *
 * A slider is a fiddly target on a phone and produces arbitrary URLs like
 * `?priceMin=37421`. Bands are one tap, read as language, and the boundaries
 * are the round numbers people actually think in. Non-overlapping by
 * construction: each band's max sits one rupee below the next band's min, so
 * no product can appear under two filters.
 */
export const PRICE_BANDS = [
  { id: "under-25", label: "Under Rs 25,000", max: 24_999 },
  { id: "25-50", label: "Rs 25,000 – 50,000", min: 25_000, max: 49_999 },
  { id: "50-100", label: "Rs 50,000 – 100,000", min: 50_000, max: 99_999 },
  { id: "over-100", label: "Over Rs 100,000", min: 100_000 },
] as const satisfies readonly {
  id: string;
  label: string;
  min?: number;
  max?: number;
}[];

export type PriceBandId = (typeof PRICE_BANDS)[number]["id"];

const PRICE_BAND_IDS = PRICE_BANDS.map((band) => band.id) as [
  PriceBandId,
  ...PriceBandId[],
];

/**
 * The open-ended bands genuinely have no `min` / no `max`, and `as const`
 * keeps that in the type — so each member has a different shape and the union
 * has neither property in common. Normalising here, rather than widening the
 * declaration, keeps `PriceBandId` a literal union for the URL schema while
 * giving callers one predictable range object.
 */
export function priceBand(
  id: string | undefined,
): { min?: number; max?: number } | undefined {
  const band = PRICE_BANDS.find((candidate) => candidate.id === id);
  if (!band) return undefined;

  return {
    min: "min" in band ? band.min : undefined,
    max: "max" in band ? band.max : undefined,
  };
}

/**
 * What the URL is allowed to say.
 *
 * Everything is optional and everything is lenient: a filter arriving from a
 * hand-edited URL, a stale bookmark, or a category that has since been deleted
 * must degrade to "no filter" and still render the catalogue. A 400 on a
 * browse page helps nobody — this is not a write boundary, and the strictness
 * that belongs on POST would here turn a mistyped link into a dead end.
 */
export const catalogParamsSchema = z.object({
  q: z.string().trim().min(1).max(120).optional().catch(undefined),
  /** Category **slug** — the URL is read by people, so /catalog?category=sofas. */
  category: z.string().trim().min(1).max(96).optional().catch(undefined),
  price: z.enum(PRICE_BAND_IDS).optional().catch(undefined),
});

export type CatalogParams = z.infer<typeof catalogParamsSchema>;

/**
 * Next hands searchParams as `string | string[] | undefined` — a repeated
 * parameter (`?category=a&category=b`) arrives as an array. Take the first;
 * these filters are single-valued and a duplicated one is a malformed link,
 * not a request for both.
 */
export function parseCatalogParams(
  raw: Record<string, string | string[] | undefined>,
): CatalogParams {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return catalogParamsSchema.parse({
    q: first(raw.q) || undefined,
    category: first(raw.category) || undefined,
    price: first(raw.price) || undefined,
  });
}

/** Is anything actually filtered? Drives the empty state and the clear link. */
export function hasActiveFilters(params: CatalogParams) {
  return Boolean(params.q || params.category || params.price);
}

/** The filter state as a query string, for links that change one facet. */
export function catalogHref(params: CatalogParams) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.price) search.set("price", params.price);

  const query = search.toString();
  return query ? `/catalog?${query}` : "/catalog";
}
