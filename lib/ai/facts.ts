import { db } from "../db";
import { formatPrice, STOCK_LABEL } from "../format";
import {
  HOURS,
  LOCATIONS,
  OFFERINGS,
  SITE,
  WHATSAPP_DISPLAY,
} from "../site";
import { productPath } from "../url";
import type { SearchedProduct } from "../product-search";

/**
 * Everything the model is allowed to know, rendered as text.
 *
 * This module is the whole grounding strategy in one place. The system prompt
 * says "use only the facts below"; this is what "below" is. Nothing about the
 * business is written into a prompt string by hand — it is composed from
 * lib/site.ts and from live rows — so the assistant cannot be right about the
 * showroom address while the footer is wrong, and updating the business in one
 * place updates what the assistant says about it.
 *
 * Two consumers, and they need the same text for different reasons:
 *   - lib/ai/prompts.ts puts it in front of the model.
 *   - lib/ai/grounding.ts scans it to build the allow-list of numbers the
 *     reply may contain. That only works because the fact block is the
 *     complete set of figures we have licensed the model to repeat.
 */

// ---------------------------------------------------------------------------
// The business
// ---------------------------------------------------------------------------

/**
 * Static, so it costs one string concat rather than a query.
 *
 * The opening-hours line is the interesting one. Opening hours are a factual
 * claim somebody acts on by driving to Shen Gul Plaza. A page can render an
 * unconfirmed one behind a caveat; a chat assistant asked "what time do you
 * open?" cannot, because the caveat is exactly what gets dropped in
 * conversation. So while `HOURS.confirmed` was false the hours were not given
 * to the model at all and it was told to hand the question to WhatsApp.
 *
 * The business has since confirmed them, the flag in lib/site.ts is true, and
 * the assistant now answers the question from the real hours — which is the
 * branch below doing what it was written for, with no edit here. The false
 * branch stays because the next time hours change and need confirming, it has
 * to come back on its own.
 */
export const BUSINESS_FACTS = [
  `BUSINESS: ${SITE.name}, a furniture and interior decor business in ${SITE.town}, ${SITE.region}, Pakistan.`,
  `WHAT WE DO: ${SITE.tagline}`,
  ...OFFERINGS.map((offering) => `OFFERING — ${offering.title}: ${offering.body}`),
  ...LOCATIONS.map(
    (location) =>
      `LOCATION — ${location.label} (${location.role}): ${location.lines.join(", ")}, Pakistan.`,
  ),
  `HOW TO ORDER: there is no online checkout, no cart and no online payment. Every enquiry, quote, price confirmation and order happens over WhatsApp on ${WHATSAPP_DISPLAY}, or in person at the showroom.`,
  `CUSTOM ORDERS: we build to a customer's own measurements in our own workshop. Anything not in the catalogue can be discussed as a custom piece over WhatsApp.`,
  HOURS.confirmed
    ? `OPENING HOURS: ${HOURS.lines.join("; ")}.`
    : `OPENING HOURS: NOT CONFIRMED. You do not know our opening hours. If asked, say so plainly and ask the customer to check on WhatsApp before travelling.`,
].join("\n");

// ---------------------------------------------------------------------------
// The catalogue, as it stands right now
// ---------------------------------------------------------------------------

export type CatalogueShape = {
  /** Real categories, for the extractor to choose from as a closed set. */
  categories: { slug: string; name: string; productCount: number }[];
  totalProducts: number;
  priceMin: number | null;
  priceMax: number | null;
};

/**
 * The shape of the catalogue — not its contents.
 *
 * Given to the model so it can answer "what kinds of furniture do you sell?"
 * and "how cheap do your sofas start?" without a product search, and so the
 * extractor picks a category from the real list instead of inventing
 * "Wardrobes" because the customer asked for one. Individual products never
 * come from here; they only ever come from a retrieval.
 *
 * Two queries per chat turn. Worth watching if the assistant gets busy — the
 * numbers change when an admin edits the catalogue, which is rarely, so this
 * is a good candidate for a short revalidating cache later. Not cached now
 * because a stale category list would silently narrow what the assistant can
 * find, and a wrong answer is worth more than two cheap queries.
 */
export async function catalogueShape(): Promise<CatalogueShape> {
  const [categories, aggregate] = await Promise.all([
    db.category.findMany({
      select: { slug: true, name: true, _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
    db.product.aggregate({
      _count: { _all: true },
      _min: { price: true },
      _max: { price: true },
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      productCount: category._count.products,
    })),
    totalProducts: aggregate._count._all,
    priceMin: aggregate._min.price,
    priceMax: aggregate._max.price,
  };
}

/** The catalogue shape as prompt text. */
export function catalogueFacts(shape: CatalogueShape) {
  const lines = [
    `CATALOGUE: ${shape.totalProducts} products listed on the website right now.`,
    `CATEGORIES (these are the only ones that exist): ${shape.categories
      .map((category) => `${category.name} (${category.productCount})`)
      .join(", ")}.`,
  ];

  if (shape.priceMin !== null && shape.priceMax !== null) {
    lines.push(
      `PRICE RANGE across the catalogue: ${formatPrice(shape.priceMin)} to ${formatPrice(shape.priceMax)}.`,
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Retrieved products
// ---------------------------------------------------------------------------

/** What the API hands back per cited product. Built from a row, never a model. */
export type ChatProduct = {
  /** 1-based, and the number the model cites as [P1]. See lib/ai/grounding.ts. */
  ref: number;
  id: string;
  name: string;
  slug: string;
  /** Site-relative; the client makes it absolute. Composed here, not by the model. */
  href: string;
  price: number;
  priceLabel: string;
  stockStatus: string;
  stockLabel: string;
  categoryName: string;
  dimensions: string | null;
  imageUrl: string | null;
};

export function toChatProducts(products: SearchedProduct[]): ChatProduct[] {
  return products.map((product, index) => ({
    ref: index + 1,
    id: product.id,
    name: product.name,
    slug: product.slug,
    href: productPath(product.slug),
    price: product.price,
    priceLabel: formatPrice(product.price),
    stockStatus: product.stockStatus,
    stockLabel: STOCK_LABEL[product.stockStatus],
    categoryName: product.category.name,
    dimensions: product.dimensions,
    imageUrl: product.images[0]?.url ?? null,
  }));
}

/**
 * How much of a description the model gets.
 *
 * The descriptions run to roughly 300 characters and carry the material and
 * construction detail that makes a product answer worth reading — sheesham
 * frame, pocket springs, hydraulic base. Truncating hard would mean the
 * assistant answering "what is it made of?" from a sentence that stops
 * mid-clause, so this cuts at a sentence boundary where it can. The cost is
 * prompt size, and prompt size is the 12,000 TPM budget.
 */
const DESCRIPTION_BUDGET = 320;

function trimDescription(description: string) {
  if (description.length <= DESCRIPTION_BUDGET) return description;

  const window = description.slice(0, DESCRIPTION_BUDGET);
  const lastStop = window.lastIndexOf(". ");
  return lastStop > DESCRIPTION_BUDGET / 2
    ? window.slice(0, lastStop + 1)
    : `${window.trimEnd()}…`;
}

/**
 * The retrieved products, as the only products the model may name.
 *
 * Note what is NOT in here: no URL. The model is never shown a link and is
 * told not to write one, because a link is the one thing a customer will act
 * on without checking. Links come back to the client in `products[].href`,
 * built from a real row by toChatProducts() above, and the UI renders them.
 * A model that hallucinates [P9] produces a dangling citation the grounding
 * check catches; a model that hallucinates a URL would produce a 404 that
 * looks exactly like a real link.
 */
export function retrievedProductFacts(
  products: SearchedProduct[],
  chatProducts: ChatProduct[],
) {
  if (chatProducts.length === 0) {
    return "RETRIEVED PRODUCTS: none. The catalogue search returned nothing for this question. You must not name any product at all in your reply.";
  }

  const entries = chatProducts.map((chatProduct, index) => {
    const source = products[index];
    return [
      `[P${chatProduct.ref}] ${chatProduct.name}`,
      `  category: ${chatProduct.categoryName}`,
      `  price: ${chatProduct.priceLabel}`,
      `  availability: ${chatProduct.stockLabel}`,
      chatProduct.dimensions ? `  dimensions: ${chatProduct.dimensions}` : null,
      `  details: ${trimDescription(source.description)}`,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return [
    "RETRIEVED PRODUCTS — these came from a live search of the database and are the ONLY products that exist for the purposes of this reply:",
    ...entries,
  ].join("\n");
}
