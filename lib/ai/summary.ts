import { formatPrice, STOCK_LABEL } from "../format";
import type { StockStatus } from "../generated/prisma/enums";
import { SITE } from "../site";
import { significantFiguresIn } from "./grounding";
import { GROQ_MODELS, groqChat, type GroqFailure } from "./groq";

/**
 * The cached product summary — one product, one paragraph, no invention.
 *
 * Narrower than the chat in every direction, and that is what makes it easier
 * to guarantee. There is no retrieval step because there is nothing to
 * retrieve: the source is a single row the admin is already looking at. There
 * are no citations because there is only one product. What is left is the part
 * that matters — the model may only re-describe what the row already says.
 *
 * The product page renders this under a permanent "Written by AI from this
 * product's details" line (components/product/ai-summary.tsx). That sentence
 * is a factual claim about where the text came from, and everything here
 * exists to keep it true.
 */

/** Exactly the fields a summary may be built from. Nothing else is passed. */
export type SummarySource = {
  name: string;
  categoryName: string;
  price: number;
  dimensions: string | null;
  description: string;
  stockStatus: StockStatus;
};

/**
 * The row, as prompt text.
 *
 * Also the allow-list the check below is built from, which is why it is one
 * function rather than a template inlined into the request: the text the model
 * sees and the text a summary is verified against have to be the same string,
 * or the check is measuring something the model was never shown.
 */
export function summaryFacts(source: SummarySource) {
  return [
    `PRODUCT: ${source.name}`,
    `CATEGORY: ${source.categoryName}`,
    `PRICE: ${formatPrice(source.price)}`,
    `AVAILABILITY: ${STOCK_LABEL[source.stockStatus]}`,
    source.dimensions ? `DIMENSIONS: ${source.dimensions}` : null,
    `DESCRIPTION (the workshop's own words): ${source.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const SYSTEM_PROMPT = [
  `You write short summaries of individual products for ${SITE.name}, a furniture and interior decor business in ${SITE.town}, Pakistan.`,
  "",
  "You will be given the complete record of ONE product. Write a summary of it.",
  "",
  "THE ONE RULE: you may only restate what the record says. You are compressing",
  "a description someone else wrote, not writing an advertisement. You know",
  "nothing about this product beyond the record — not the wood species, not the",
  "fabric, not the lead time, not who made it — unless the record says so.",
  "",
  "NEVER ADD:",
  "  - materials, finishes, colours or construction details not in the record",
  "  - delivery, shipping, assembly, warranty, guarantee or returns claims",
  "  - discounts, offers, instalments or anything about payment",
  "  - comparisons to other products, ours or anyone else's",
  "  - superlatives you cannot support: best-selling, premium, luxury,",
  "    handcrafted, top quality, market-leading",
  "",
  "DO NOT state the price. The page already shows it directly above your text,",
  "and a figure repeated by a machine is a figure that can go wrong.",
  "",
  "HOW TO WRITE IT:",
  "  - Two or three sentences. 45 to 65 words. One paragraph, no line breaks.",
  "  - Lead with what the piece IS and what it is made of, from the record.",
  "  - Then the thing that would decide it for someone: how it is built, what",
  "    room or use it suits, what its size means in practice.",
  "  - Plain English for a customer in Mardan. British spelling.",
  "  - Third person about the product. Do not address the reader, do not say",
  "    \"we\", and do not end with a call to action.",
  "  - No markdown, no headings, no bullet points, no quotation marks.",
  "",
  "Return only the summary text.",
].join("\n");

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

/**
 * Claims a customer would act on, which no product record here contains.
 *
 * The figure check below catches an invented price. This catches the other
 * half of the problem, which is qualitative: "comes with a two-year warranty"
 * has no number in it, is exactly the sort of thing a helpful model adds
 * unprompted, and is a promise the workshop never made.
 *
 * Each word is allowed the moment the product's own record uses it — a
 * description that genuinely mentions delivery can be summarised as mentioning
 * delivery. So this is not a banned-word list; it is a list of words that must
 * be EARNED from the source.
 *
 * Kept tight on purpose. "offer", "free" and "sale" were tried and dropped:
 * they collide with ordinary furniture prose ("offers generous storage",
 * "free-standing"), and a check that fires on good text gets ignored.
 */
const EARNED_CLAIMS = [
  "warranty",
  "warranties",
  "guarantee",
  "guaranteed",
  "discount",
  "discounted",
  "delivery",
  "delivered",
  "shipping",
  "refund",
  "instalment",
  "installment",
  "emi",
  "financing",
] as const;

export type SummaryVerdict =
  | { grounded: true }
  | { grounded: false; reason: string };

/**
 * Does this summary say anything the record does not?
 *
 * Runs on generation AND again on save (see the route). Checking twice is not
 * belt-and-braces theatre: the two calls are at different trust boundaries.
 * Generation checks what the model produced; save checks what actually arrives
 * in the request body, which is the only thing that can reach the column.
 */
export function checkSummaryGrounding(
  summary: string,
  source: SummarySource,
): SummaryVerdict {
  const facts = summaryFacts(source);

  const allowed = significantFiguresIn(facts);
  for (const value of significantFiguresIn(summary)) {
    if (!allowed.has(value)) {
      return {
        grounded: false,
        reason: `it states the figure ${value}, which does not appear anywhere in this product's details`,
      };
    }
  }

  const sourceWords = facts.toLowerCase();
  for (const claim of EARNED_CLAIMS) {
    const pattern = new RegExp(`\\b${claim}\\b`, "i");
    if (pattern.test(summary) && !pattern.test(sourceWords)) {
      return {
        grounded: false,
        reason: `it claims something about "${claim}", which this product's details never mention`,
      };
    }
  }

  return { grounded: true };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * Bounds on what may be stored, shared by the generator and the save schema.
 * A summary far outside these is not a summary, whatever produced it.
 */
export const SUMMARY_MIN_LENGTH = 40;
export const SUMMARY_MAX_LENGTH = 700;

export type SummaryOutcome =
  | { ok: true; summary: string }
  /** Groq itself — rate limited, down, or not configured. */
  | { ok: false; kind: "GROQ"; failure: GroqFailure }
  /** A reply arrived and was rejected. The admin regenerates. */
  | { ok: false; kind: "UNGROUNDED"; reason: string };

/**
 * Tidy the model's output into one paragraph.
 *
 * The prompt asks for no line breaks and gets them anyway, along with the
 * occasional wrapping quotation mark. Collapsing whitespace is safe — it
 * cannot change a claim — and it means the column holds a paragraph rather
 * than something whose rendering depends on where the model put a newline.
 */
function tidy(raw: string) {
  return raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateProductSummary(
  source: SummarySource,
): Promise<SummaryOutcome> {
  const result = await groqChat({
    model: GROQ_MODELS.answer,
    // 0.6, higher than the chat's 0.3, and the reason is the Regenerate
    // button. This started at 0.2 on the reasoning that a cached summary is
    // read once so variety is worthless — which was exactly backwards. At 0.2
    // two consecutive generations for the same product came back byte for
    // byte identical, so an owner who did not like a draft could press
    // Regenerate all afternoon and be handed the same paragraph.
    //
    // Correctness does not come from a low temperature here. It comes from
    // checkSummaryGrounding() below, which runs on every draft and again on
    // save, and from an owner reading the text before it is published. Given
    // that, the temperature's only job is to make the second draft worth
    // asking for.
    temperature: 0.6,
    // 65 words of prose, plus the reasoning tokens billed against the same
    // ceiling. See the note on maxTokens in lib/ai/groq.ts.
    maxTokens: 500,
    reasoningEffort: "low",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: summaryFacts(source) },
    ],
  });

  if (!result.ok) return { ok: false, kind: "GROQ", failure: result.failure };

  const summary = tidy(result.content);

  if (summary.length < SUMMARY_MIN_LENGTH) {
    return {
      ok: false,
      kind: "UNGROUNDED",
      reason: "the model returned too little text to be a summary",
    };
  }
  if (summary.length > SUMMARY_MAX_LENGTH) {
    return {
      ok: false,
      kind: "UNGROUNDED",
      reason: `the model returned ${summary.length} characters, past the ${SUMMARY_MAX_LENGTH} allowed`,
    };
  }

  const verdict = checkSummaryGrounding(summary, source);
  if (!verdict.grounded) {
    // Loud, like the chat's equivalent. A run of these is a prompt regression,
    // and the admin only ever sees "try again".
    console.error(
      "[summary] rejected a draft:",
      verdict.reason,
      "\n  product:",
      source.name,
      "\n  draft:",
      summary,
    );
    return { ok: false, kind: "UNGROUNDED", reason: verdict.reason };
  }

  // NOT RETRIED AUTOMATICALLY. A silent second attempt would hide exactly the
  // signal the log line above exists to raise, and would spend two of a
  // 1,000/day budget on one click. Regenerate is one button, and the admin is
  // already sitting in front of it.
  return { ok: true, summary };
}
