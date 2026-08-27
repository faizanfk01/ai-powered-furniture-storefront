import { buildAssistantHandoffMessage } from "../messages";
import { whatsappUrl } from "../site";
import type { ChatMessageInput, ChatRequestInput } from "../validations/chat";
import {
  BUSINESS_FACTS,
  catalogueFacts,
  catalogueShape,
  retrievedProductFacts,
  toChatProducts,
  type ChatProduct,
} from "./facts";
import {
  checkGrounding,
  fallbackReply,
  normaliseCitations,
  withNamedProducts,
} from "./grounding";
import { GROQ_MODELS, groqChat, type GroqFailure, type GroqMessage } from "./groq";
import { answerSystemPrompt } from "./prompts";
import { extractIntent, retrieve, type ChatTopic } from "./retrieval";

/**
 * One chat turn, end to end.
 *
 *   catalogue shape  →  extract intent (8B)  →  SQL retrieval  →  answer (70B)
 *                                                             →  grounding check
 *
 * The order matters and is the point. Retrieval sits between the two model
 * calls, so the model that writes the customer-facing reply is only ever shown
 * products that a SELECT returned. It is never asked what we sell; it is told,
 * and then checked.
 *
 * Returns a discriminated result rather than throwing, so app/api/chat/route.ts
 * is a mapping from outcomes to status codes and has no try/catch around
 * business logic. The one thing this phase forbids — a raw 500 or a hang — is
 * therefore not reachable from a Groq failure: every failure has a name here.
 */

/**
 * Six messages, three turns.
 *
 * Enough for "do you have dining tables?" → answer → "under 50,000?" to
 * resolve, which is the follow-up pattern that actually happens. Longer
 * histories mostly buy prompt size, and prompt size is the 12,000 TPM budget
 * the answer model runs on.
 */
const HISTORY_WINDOW = 6;

export type ChatSuccess = {
  ok: true;
  /** Carries [P1] citation tags. The UI resolves them against `products`. */
  reply: string;
  /** Real rows. The only products in existence as far as this reply goes. */
  products: ChatProduct[];
  /** Refs the reply actually cited, in the order it cited them. */
  citations: number[];
  /**
   * False when the model's own reply failed the grounding check and a
   * deterministic one was substituted. Surfaced rather than hidden because a
   * run of these is a prompt regression, and it should be visible in a log or
   * an admin view rather than only in the model's word choice.
   */
  grounded: boolean;
  /** What actually reached SQL — so any answer can be audited after the fact. */
  retrieval: {
    topic: ChatTopic;
    searched: boolean;
    matched: number;
    filters: {
      q?: string;
      categoryName?: string;
      priceMin?: number;
      priceMax?: number;
      stockStatus?: string;
    };
  };
  /** Pre-filled wa.me link — the only conversion path (CLAUDE.md → Payments). */
  whatsappUrl: string;
};

export type ChatResult = ChatSuccess | { ok: false; failure: GroqFailure };

/** History as Groq messages. Oldest dropped; roles are already Zod-narrowed. */
function toGroqHistory(history: ChatMessageInput[]): GroqMessage[] {
  return history.slice(-HISTORY_WINDOW).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export async function runChat(input: ChatRequestInput): Promise<ChatResult> {
  const shape = await catalogueShape();
  const history = toGroqHistory(input.history);

  // Pass 1. A failure here is survivable — extractIntent falls back to a plain
  // text search of the customer's words — except for a missing key, which the
  // answer call would hit too. Bailing now saves a pointless search.
  const { extraction, failure: extractFailure } = await extractIntent(
    input.message,
    history,
    shape,
  );

  if (extractFailure?.kind === "NOT_CONFIGURED") {
    return { ok: false, failure: extractFailure };
  }

  // Retrieval. This is where products come from, and the only place.
  const retrieval = await retrieve(extraction, shape);
  const products = toChatProducts(retrieval.products);
  const productFacts = retrievedProductFacts(retrieval.products, products);

  const systemPrompt = answerSystemPrompt({
    shape,
    productFacts,
    offTopic: extraction.topic === "OFF_TOPIC",
    appliedFilters: {
      ...(retrieval.applied.categoryName
        ? { categoryName: retrieval.applied.categoryName }
        : {}),
      ...(retrieval.applied.priceMin !== undefined
        ? { priceMin: retrieval.applied.priceMin }
        : {}),
      ...(retrieval.applied.priceMax !== undefined
        ? { priceMax: retrieval.applied.priceMax }
        : {}),
      ...(retrieval.applied.stockStatus
        ? { stockStatus: retrieval.applied.stockStatus }
        : {}),
    },
  });

  // Pass 2.
  const answer = await groqChat({
    model: GROQ_MODELS.answer,
    // Not zero. The reply is written prose, and a frozen model produces the
    // same three sentences for every product question, which reads like a
    // form letter. Low enough that the facts stay where they were put.
    temperature: 0.3,
    // 600 for a reply capped at 110 words: reasoning tokens are billed against
    // this too, and a cap that reasoning exhausts returns an empty completion.
    maxTokens: 600,
    reasoningEffort: "low",
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: input.message },
    ],
  });

  if (!answer.ok) {
    // Nothing is salvaged into a half-answer here. The customer asked a
    // question; a partial reply that omits the part we could not generate is
    // worse than "the assistant is busy — here is WhatsApp", because it looks
    // like a complete answer.
    return { ok: false, failure: answer.failure };
  }

  // Normalised before it is checked and before it is returned, so the reply
  // the customer sees and the text the grounding check ran against are the
  // same string. See normaliseCitations() — the model does not reliably write
  // the bracket it was asked for.
  const reply = normaliseCitations(answer.content.trim());

  // The check. `facts` is exactly what the model was shown — the same strings,
  // not a reconstruction — so the allow-list cannot drift from the prompt.
  const verdict = checkGrounding(
    reply,
    [BUSINESS_FACTS, catalogueFacts(shape), productFacts].join("\n"),
    input.message,
    products,
  );

  if (!verdict.grounded) {
    // Loud on purpose. This is the failure mode the whole phase exists to
    // prevent, and it is invisible from the outside — the customer just gets a
    // slightly plainer answer. If it starts happening, it has to be findable.
    console.error(
      "[chat] grounding check rejected a reply:",
      verdict.reason,
      "\n  message:",
      input.message,
      "\n  reply:",
      reply,
    );
  }

  const finalReply = verdict.grounded ? reply : fallbackReply(products);
  // Tagged citations, plus any product the reply named without tagging — see
  // withNamedProducts(). Both only ever contain refs of retrieved rows.
  const citations = verdict.grounded
    ? withNamedProducts(reply, verdict.citations, products)
    : products.map((product) => product.ref);

  return {
    ok: true,
    reply: finalReply,
    products,
    citations,
    grounded: verdict.grounded,
    retrieval: {
      topic: extraction.topic,
      searched: retrieval.searched,
      matched: products.length,
      filters: {
        ...(retrieval.applied.q ? { q: retrieval.applied.q } : {}),
        ...(retrieval.applied.categoryName
          ? { categoryName: retrieval.applied.categoryName }
          : {}),
        ...(retrieval.applied.priceMin !== undefined
          ? { priceMin: retrieval.applied.priceMin }
          : {}),
        ...(retrieval.applied.priceMax !== undefined
          ? { priceMax: retrieval.applied.priceMax }
          : {}),
        ...(retrieval.applied.stockStatus
          ? { stockStatus: retrieval.applied.stockStatus }
          : {}),
      },
    },
    // Prefilled with the first product the reply actually cited, so the shop
    // opens a chat already knowing which piece is being asked about — the same
    // trick the product page CTA plays, and the reason whatsappUrl() takes a
    // message at all.
    whatsappUrl: whatsappUrl(
      buildAssistantHandoffMessage({
        question: input.message,
        productName: products.find((product) => product.ref === citations[0])?.name,
      }),
    ),
  };
}
