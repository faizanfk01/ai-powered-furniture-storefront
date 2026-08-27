import { z } from "zod";

import { db } from "../db";
import type { StockStatus } from "../generated/prisma/enums";
import { searchProducts, type SearchedProduct } from "../product-search";
import { stockStatusSchema } from "../validations/common";
import { productSearchQuerySchema } from "../validations/search";
import type { CatalogueShape } from "./facts";
import { GROQ_MODELS, groqChat, type GroqFailure, type GroqMessage } from "./groq";
import { extractionSystemPrompt } from "./prompts";

/**
 * Turning a sentence into a real catalogue query.
 *
 * The model's only job here is to say what to look for. It does not choose the
 * products — the database does, through lib/product-search.ts, the same
 * pg_trgm ranking the /catalog page and /api/products/search already use. That
 * is the whole grounding argument in one sentence: a product reaches a reply
 * only by coming back from a SELECT.
 *
 * Reusing searchProducts() rather than writing an "AI search" is deliberate
 * and is what CLAUDE.md's "do NOT invent a new search" asks for. A second
 * implementation would be a second answer to "find me a sofa", and the two
 * would drift — with the assistant quoting products the catalogue page cannot
 * show, which is indistinguishable from a hallucination to a customer.
 */

/**
 * Six products, not twenty.
 *
 * The cap is a prompt-budget decision, not a UI one. Each product costs
 * roughly 120 tokens of fact block, and the answer model has 8,000 tokens per
 * minute to spend. Six is also about as many as a useful chat reply can
 * actually discuss — beyond that the model starts listing rather than
 * recommending, and the customer is better served by the catalogue page.
 */
const RETRIEVAL_LIMIT = 6;

/**
 * How relevant a trigram hit has to be before the assistant will show it.
 *
 * DELIBERATELY STRICTER THAN THE CATALOGUE'S OWN FLOOR, and the reason is that
 * the two surfaces make different claims. lib/product-search.ts filters at
 * 0.05, which is right for a browse page: results are offered in ranked order,
 * a weak match sits at the bottom, and the customer decides. A chat reply does
 * not work that way. Attaching a product to an answer asserts that it is
 * relevant, and the products come back in the API response as cards.
 *
 * Measured against this catalogue, the gap between the two cases is wide:
 *
 *   "sofa"        1.011   "chandeliers"           0.283
 *   "study desk"  1.076   "wardrobe"              0.235
 *   "sofaa" (typo) 0.678  "curtains"              0.124
 *
 * 0.45 sits in the middle of that gap — well clear of the best score any
 * absent item achieved, and well under the worst score a real hit achieved
 * even with a typo. It also drops the second-rank noise that a low floor lets
 * through: "sofa" scores 0.412 against a sheesham BED, which is fine at the
 * bottom of a search page and absurd underneath a chat answer about sofas.
 *
 * Observed before this existed: "do you have any chandeliers?" returned an
 * accent chair, a coffee table and four others, every one of them above 0.05.
 *
 * Only applies to ranked results. A filter-only search (a budget with no
 * search terms) carries no similarity and is not touched — nothing there
 * claims to be about a topic.
 */
const AI_RELEVANCE_FLOOR = 0.45;

// ---------------------------------------------------------------------------
// Pass 1 — what the model said the customer wants
// ---------------------------------------------------------------------------

export type ChatTopic = "PRODUCTS" | "BUSINESS" | "OFF_TOPIC";

/**
 * The JSON schema Groq decodes against, built from the live category list.
 *
 * `category` is an enum of the slugs that exist right now, so constrained
 * decoding makes an invented category literally unrepresentable — the model
 * cannot emit "wardrobes" because those tokens are not reachable. That is a
 * stronger guarantee than resolveCategory()'s check below, which stays anyway
 * for the paths that do not go through this schema (a fallback extraction, or
 * a future model without strict support).
 *
 * `strict: true` requires every property listed in `required` and
 * `additionalProperties: false`, hence the explicit nulls rather than optional
 * keys — see the note in lib/ai/groq.ts on jsonSchema.
 */
function extractionJsonSchema(shape: CatalogueShape): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: ["topic", "search", "category", "priceMin", "priceMax", "stockStatus"],
    properties: {
      topic: { type: "string", enum: ["PRODUCTS", "BUSINESS", "OFF_TOPIC"] },
      search: { type: ["string", "null"] },
      category: {
        type: ["string", "null"],
        enum: [...shape.categories.map((category) => category.slug), null],
      },
      priceMin: { type: ["integer", "null"] },
      priceMax: { type: ["integer", "null"] },
      stockStatus: {
        type: ["string", "null"],
        enum: ["IN_STOCK", "OUT_OF_STOCK", "MADE_TO_ORDER", null],
      },
    },
  };
}

/**
 * Every field is `.catch()`-guarded and the whole thing is safeParsed.
 *
 * Belt and braces on purpose. Constrained decoding guarantees the SHAPE of the
 * object; it says nothing about whether the values are sane, and it is not in
 * force on the fallback path or if the model id is ever changed to one without
 * strict support. Each `.catch()` drops one bad field to null rather than
 * failing the whole extraction and losing the good fields with it.
 *
 * A dropped field always fails toward a WIDER search. Losing a priceMax means
 * showing something over budget, which the model can then talk about honestly.
 * The opposite — inventing a filter — would hide real products behind a
 * constraint nobody asked for, and the customer would be told we have nothing.
 */
const extractionSchema = z.object({
  topic: z.enum(["PRODUCTS", "BUSINESS", "OFF_TOPIC"]).catch("PRODUCTS"),
  search: z.string().trim().min(1).max(120).nullish().catch(null),
  category: z.string().trim().min(1).max(96).nullish().catch(null),
  priceMin: z.number().int().min(0).max(100_000_000).nullish().catch(null),
  priceMax: z.number().int().min(0).max(100_000_000).nullish().catch(null),
  stockStatus: stockStatusSchema.nullish().catch(null),
});

export type Extraction = {
  topic: ChatTopic;
  search: string | null;
  categorySlug: string | null;
  priceMin: number | null;
  priceMax: number | null;
  stockStatus: StockStatus | null;
};

/**
 * When extraction fails outright — bad JSON, or Groq itself down for pass 1.
 *
 * Falls back to a plain text search of the customer's own words. That is a
 * worse search than a good extraction, but it is still a real search returning
 * real rows, so the grounding guarantee is untouched. The alternative — giving
 * up on the turn — would fail a request the answer model could still handle.
 */
function fallbackExtraction(message: string): Extraction {
  return {
    topic: "PRODUCTS",
    search: message.slice(0, 120),
    categorySlug: null,
    priceMin: null,
    priceMax: null,
    stockStatus: null,
  };
}

/**
 * Resolve whatever the model called a category against the real table.
 *
 * The prompt gives it a closed list of slugs, and it will still occasionally
 * answer "Tables" or "dining tables". Slug, then name, then a contained-name
 * match — and if none of those hit, the filter is DROPPED rather than guessed
 * at. A wrong category filter is the most damaging thing that can come out of
 * this function: it is a hard SQL constraint, so it does not degrade the
 * ranking, it removes the right answer from the result set entirely and the
 * assistant then truthfully reports we have nothing.
 */
async function resolveCategory(
  raw: string | null,
  shape: CatalogueShape,
): Promise<{ id: string; name: string } | null> {
  if (!raw) return null;

  const needle = raw.trim().toLowerCase();
  const match =
    shape.categories.find((category) => category.slug.toLowerCase() === needle) ??
    shape.categories.find((category) => category.name.toLowerCase() === needle) ??
    shape.categories.find(
      (category) =>
        category.name.toLowerCase().includes(needle) ||
        needle.includes(category.name.toLowerCase()),
    );

  if (!match) return null;

  // searchProducts filters on categoryId, not slug — the id is what every
  // product payload carries, so the slug is resolved to one here.
  const category = await db.category.findUnique({
    where: { slug: match.slug },
    select: { id: true },
  });

  return category ? { id: category.id, name: match.name } : null;
}

export async function extractIntent(
  message: string,
  history: GroqMessage[],
  shape: CatalogueShape,
): Promise<{ extraction: Extraction; failure?: GroqFailure }> {
  const result = await groqChat({
    model: GROQ_MODELS.extract,
    // Zero: this is a parse, not a piece of writing. The same sentence should
    // produce the same filters every time, so that "sofas under 80000" cannot
    // return different products on two consecutive asks.
    temperature: 0,
    // Generous for a six-key object because reasoning tokens come out of the
    // same allowance — see the note on maxTokens in lib/ai/groq.ts.
    maxTokens: 300,
    reasoningEffort: "low",
    jsonSchema: { name: "catalogue_query", schema: extractionJsonSchema(shape) },
    messages: [
      { role: "system", content: extractionSystemPrompt(shape) },
      ...history,
      { role: "user", content: message },
    ],
  });

  if (!result.ok) {
    return { extraction: fallbackExtraction(message), failure: result.failure };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(result.content);
  } catch {
    return { extraction: fallbackExtraction(message) };
  }

  const parsed = extractionSchema.safeParse(parsedJson);
  if (!parsed.success) return { extraction: fallbackExtraction(message) };

  return {
    extraction: {
      topic: parsed.data.topic,
      search: parsed.data.search ?? null,
      categorySlug: parsed.data.category ?? null,
      priceMin: parsed.data.priceMin ?? null,
      priceMax: parsed.data.priceMax ?? null,
      stockStatus: parsed.data.stockStatus ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Pass 2 — the actual search
// ---------------------------------------------------------------------------

export type Retrieval = {
  /** False for off-topic messages, where no search is run at all. */
  searched: boolean;
  products: SearchedProduct[];
  /** The filters that reached SQL — reported back so the answer is auditable. */
  applied: {
    q?: string;
    categoryId?: string;
    categoryName?: string;
    priceMin?: number;
    priceMax?: number;
    stockStatus?: StockStatus;
  };
};

/**
 * Run the extraction against the catalogue.
 *
 * Price, category and stock are HARD constraints: they become `price <= ?`,
 * `"categoryId" = ?` and `"stockStatus" = ?` bind parameters inside
 * lib/product-search.ts. There is no path by which a product outside them
 * reaches the fact block, so "never recommend something over budget" is a
 * property of the SQL rather than a hope about the prompt. `q` only ranks —
 * a typo softens the ordering, it does not empty the result.
 */
/** Drop ranked hits below the floor. Unranked results pass through untouched. */
function relevantOnly(products: SearchedProduct[]) {
  return products.filter(
    (product) =>
      product.similarity === undefined || product.similarity >= AI_RELEVANCE_FLOOR,
  );
}

export async function retrieve(
  extraction: Extraction,
  shape: CatalogueShape,
): Promise<Retrieval> {
  // An off-topic message gets no search. Nothing to retrieve, and it saves a
  // query on exactly the requests we least want to spend anything on.
  if (extraction.topic === "OFF_TOPIC") {
    return { searched: false, products: [], applied: {} };
  }

  // A business question with nothing to search on gets no search either.
  //
  // Without this, "where is your showroom?" reaches searchProducts() with no q
  // and no filters, which is a valid catalogue browse — it returns the six
  // cheapest products. They then land in the fact block, and in the API
  // response, and the UI renders six product cards under an answer about an
  // address. Observed: "do you have any chandeliers?" came back with an
  // accent chair, a coffee table and four others attached.
  //
  // Note the condition is BUSINESS *and* empty. A PRODUCTS message with no
  // terms and no filters is "show me what you have", which is a real browse
  // and must keep working.
  const hasSomethingToSearch =
    extraction.search !== null ||
    extraction.categorySlug !== null ||
    extraction.priceMin !== null ||
    extraction.priceMax !== null ||
    extraction.stockStatus !== null;

  if (extraction.topic === "BUSINESS" && !hasSomethingToSearch) {
    return { searched: false, products: [], applied: {} };
  }

  const category = await resolveCategory(extraction.categorySlug, shape);
  const candidate = {
    ...(extraction.search ? { q: extraction.search } : {}),
    ...(category ? { categoryId: category.id } : {}),
    ...(extraction.priceMin !== null ? { priceMin: extraction.priceMin } : {}),
    ...(extraction.priceMax !== null ? { priceMax: extraction.priceMax } : {}),
    ...(extraction.stockStatus ? { stockStatus: extraction.stockStatus } : {}),
    limit: RETRIEVAL_LIMIT,
    offset: 0,
  };

  // The same Zod schema the HTTP search endpoint validates against.
  //
  // Not ceremony: the input here is model output, so it can carry
  // priceMin > priceMax ("between 80 and 40 thousand" read backwards), which
  // the schema's refine catches. Going through it means the AI layer cannot
  // construct a query the public API would have rejected — one definition of
  // a valid catalogue search, for both callers.
  const parsed = productSearchQuerySchema.safeParse(candidate);

  if (!parsed.success) {
    // The filters contradicted each other. Drop them and keep the text search:
    // a wider, honest result beats a 500 on a browse question.
    const relaxed = productSearchQuerySchema.parse({
      ...(extraction.search ? { q: extraction.search } : {}),
      limit: RETRIEVAL_LIMIT,
      offset: 0,
    });
    return {
      searched: true,
      products: relevantOnly(await searchProducts(relaxed)),
      applied: { ...(relaxed.q ? { q: relaxed.q } : {}) },
    };
  }

  const products = relevantOnly(await searchProducts(parsed.data));

  return {
    searched: true,
    products,
    applied: {
      ...(parsed.data.q ? { q: parsed.data.q } : {}),
      ...(category ? { categoryId: category.id, categoryName: category.name } : {}),
      ...(parsed.data.priceMin !== undefined ? { priceMin: parsed.data.priceMin } : {}),
      ...(parsed.data.priceMax !== undefined ? { priceMax: parsed.data.priceMax } : {}),
      ...(parsed.data.stockStatus ? { stockStatus: parsed.data.stockStatus } : {}),
    },
  };
}
