import { NextResponse } from "next/server";

import {
  apiError,
  handleApiError,
  notFound,
  readJson,
  requireAdmin,
  validationFailed,
} from "@/lib/api";
import {
  checkSummaryGrounding,
  generateProductSummary,
  type SummarySource,
} from "@/lib/ai/summary";
import { db } from "@/lib/db";
import { summarySaveSchema } from "@/lib/validations/summary";

// ---------------------------------------------------------------------------
// ADMIN. Guarded twice, for the same reason as the R2 presign route.
//
// proxy.ts blocks unauthenticated requests to /api/admin/:path* before this
// file runs, and that is the primary guard. requireAdmin() is here anyway
// because POST spends a metered third-party budget — 1,000 generations a day,
// shared with the storefront assistant. The proxy's protection lives in a
// matcher array in another file, where an edit could drop this path without
// anything in this file changing to show that a public endpoint had just
// gained the ability to drain the day's Groq quota.
//
// Three verbs, three steps of one review-then-publish flow:
//
//   POST   generate a draft and return it. Writes NOTHING.
//   PUT    publish a draft the admin has read.
//   DELETE clear the published summary.
//
// The split is the whole point of the feature. Generation is not publication:
// the owner reads the draft first, and the product page's "Written by AI"
// disclosure is only ever attached to text a person chose to publish.
// ---------------------------------------------------------------------------

const NOT_FOUND_MESSAGE = "Product not found";

/** Exactly the columns a summary may be built from — see lib/ai/summary.ts. */
const SUMMARY_SELECT = {
  id: true,
  name: true,
  price: true,
  dimensions: true,
  description: true,
  stockStatus: true,
  category: { select: { name: true } },
} as const;

type SummaryRow = {
  name: string;
  price: number;
  dimensions: string | null;
  description: string;
  stockStatus: SummarySource["stockStatus"];
  category: { name: string };
};

function toSource(product: SummaryRow): SummarySource {
  return {
    name: product.name,
    categoryName: product.category.name,
    price: product.price,
    dimensions: product.dimensions,
    description: product.description,
    stockStatus: product.stockStatus,
  };
}

/**
 * POST — write a draft, save nothing.
 *
 * The response carries the text and the source it was built from, so the admin
 * screen can show the draft beside the fields it came from rather than asking
 * the owner to trust it.
 */
export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/products/[id]/summary">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  let product;
  try {
    product = await db.product.findUnique({
      where: { id },
      select: SUMMARY_SELECT,
    });
  } catch (error) {
    return handleApiError(error);
  }

  if (!product) return notFound(NOT_FOUND_MESSAGE);

  const outcome = await generateProductSummary(toSource(product));

  if (outcome.ok) {
    return NextResponse.json({ summary: outcome.summary });
  }

  // A rejected draft is a 422, not a 500. Nothing is broken — the model wrote
  // something it was not entitled to say and the check did its job. The screen
  // turns this into "that draft mentioned something not in this product's
  // details" with a Regenerate button, which is a true and actionable sentence.
  if (outcome.kind === "UNGROUNDED") {
    return apiError(
      422,
      "AI_UNGROUNDED",
      `The generated summary was rejected because ${outcome.reason}. Nothing was saved — try generating again.`,
    );
  }

  // Groq itself. Same two codes and statuses the chat route uses, so the admin
  // screen and the storefront widget read failures identically.
  if (outcome.failure.kind === "RATE_LIMITED") {
    const response = apiError(
      429,
      "AI_BUSY",
      "The AI service is rate limited right now. Wait a moment and try again.",
    );
    if (outcome.failure.retryAfterSeconds !== undefined) {
      response.headers.set("retry-after", String(outcome.failure.retryAfterSeconds));
    }
    return response;
  }

  if (outcome.failure.kind === "NOT_CONFIGURED") {
    console.error("[summary] GROQ_API_KEY is not set");
  } else {
    console.error("[summary] groq unavailable:", outcome.failure.detail);
  }

  return apiError(
    503,
    "AI_UNAVAILABLE",
    "The AI service could not be reached. Try again in a moment.",
  );
}

/**
 * PUT — publish a draft.
 *
 * THE GROUNDING CHECK RUNS AGAIN HERE, and this is the one that actually
 * protects the column. POST's check governs what the model produced; this one
 * governs what arrives in the request body, which is the only thing that can
 * reach the database. Without it the guarantee would rest on the browser
 * having sent back the same string it was given, which is not a guarantee at
 * all — it is a hope about a client.
 *
 * So a summary in the column is grounded in that product's fields no matter
 * how it got here: through the button, through a stale tab, or through curl.
 */
export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/products/[id]/summary">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = summarySaveSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  let product;
  try {
    product = await db.product.findUnique({
      where: { id },
      select: SUMMARY_SELECT,
    });
  } catch (error) {
    return handleApiError(error);
  }

  if (!product) return notFound(NOT_FOUND_MESSAGE);

  const verdict = checkSummaryGrounding(parsed.data.summary, toSource(product));
  if (!verdict.grounded) {
    console.error(
      "[summary] refused to save an ungrounded summary:",
      verdict.reason,
      "\n  product:",
      product.name,
    );
    return apiError(
      422,
      "AI_UNGROUNDED",
      `That summary was not saved because ${verdict.reason}.`,
    );
  }

  try {
    const updated = await db.product.update({
      where: { id },
      data: { aiSummary: parsed.data.summary },
      select: { id: true, aiSummary: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, { notFound: NOT_FOUND_MESSAGE });
  }
}

/**
 * DELETE — clear the published summary.
 *
 * Idempotent: clearing a product that has no summary is a 200, not a 404. The
 * caller asked for the column to be empty and the column is empty.
 */
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/products/[id]/summary">,
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const updated = await db.product.update({
      where: { id },
      data: { aiSummary: null },
      select: { id: true, aiSummary: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, { notFound: NOT_FOUND_MESSAGE });
  }
}
