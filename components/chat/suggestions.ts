import type { ChatProduct } from "@/lib/ai/facts";

/**
 * The quick-reply chips.
 *
 * A chip is a PRE-WRITTEN MESSAGE, nothing more. Tapping one calls the same
 * send() a typed message calls, which posts to the same POST /api/chat, which
 * runs the same retrieval and the same grounding check. There is no chip
 * endpoint, no chip payload and no way for a chip to reach a different code
 * path — if a chip's text were typed by hand into the composer the result
 * would be byte-identical. That is the whole safety argument and it is
 * structural rather than promised.
 *
 * WHERE THE TEXT COMES FROM, and why it is not the model.
 *
 * Two sources only:
 *
 *   1. AUTHORED HERE. Written once, reviewed like any other copy on the site.
 *   2. A CATEGORY NAME OUT OF A DATABASE ROW that came back with this very
 *      reply — `ChatProduct.categoryName`, the same string the product card
 *      beside it prints.
 *
 * Never the model. A chip is a question the SHOP is putting in the customer's
 * mouth, and a generated one would be an ungrounded claim with a question mark
 * on the end: "Do you offer free delivery?" is not neutral, it is an
 * advertisement for a service nobody said we provide, and the honest answer
 * that follows ("the listing doesn't specify, ask on WhatsApp") arrives too
 * late to unask it. The grounding check would never see it either — it checks
 * REPLIES, and a chip is an input.
 *
 * SO EVERY CHIP'S PREMISE HAS TO BE TRUE ALREADY. Each one below asks about
 * something lib/ai/facts.ts states outright: that we sell these categories,
 * that pieces have prices and stock states, that we build to a customer's own
 * measurements, that there is a showroom, and that ordering happens on
 * WhatsApp. Deliberately absent, because the business has not said them:
 * delivery, charges, warranty, returns, discounts, payment plans — and
 * OPENING HOURS, which lib/site.ts explicitly marks unconfirmed and which
 * facts.ts therefore withholds from the model. A chip inviting a question we
 * have decided not to answer is worse than no chip.
 *
 * WHATSAPP. "How do I place an order?" is the chip that leads there, and it
 * leads there by being answered: rule 6 of the answer prompt says WhatsApp is
 * the only way to buy, so the grounded reply says so in the shop's own words.
 * A chip that was itself a wa.me link would be a different control wearing a
 * chip's clothes, and would break the one sentence above that makes all of
 * this safe.
 */

export type ChatScope =
  /** The global drawer: the whole catalogue and the business. */
  | { kind: "site" }
  /** The product modal, scoped to one piece. */
  | { kind: "product"; productName: string };

/**
 * Mirrors the shape ChatConversation stores for an assistant turn.
 *
 * Rows, refs and a classification — deliberately no reply text. There is no
 * parameter here the model's words could arrive through, which is a stronger
 * guarantee than a rule saying not to use them.
 */
export type ReplyContext = {
  /** Everything retrieved for the turn. Empty when nothing matched. */
  products: ChatProduct[];
  /** Refs the reply actually cited, in the order it cited them. */
  citations: number[];
  /** PRODUCTS | BUSINESS | OFF_TOPIC, straight from the API's own metadata. */
  topic: string;
};

const HOW_TO_ORDER = "How do I place an order?";
const CUSTOM_ORDERS = "How do custom orders work?";
const MAKE_TO_SIZE = "Can you make one to my measurements?";
const CHEAPER = "Do you have anything cheaper?";
const IN_STOCK = "What do you have in stock?";
const SHOWROOM = "Where is your showroom?";

/**
 * The opening three, unchanged from the examples the drawer has shown since
 * the panel was built.
 *
 * They are not decoration: they are the SCOPE of the assistant, shown rather
 * than described, one from each thing it can actually do — a category, a
 * budget, and the business itself. Somebody who opens a blank chat box has to
 * guess what it can answer, and most people guess wrong.
 */
const SITE_STARTERS = [
  "What sofas do you have?",
  "Show me tables under Rs 30,000",
  SHOWROOM,
];

/**
 * The product modal's follow-up chips.
 *
 * Safe for the same reason the others are: materials and dimensions are real
 * columns on the row being discussed, and building to a different size is in
 * the business facts. Where a listing happens not to say what a piece is made
 * of, rule 4 of the answer prompt has already decided what happens — "the
 * listing doesn't specify" is the correct and complete reply — so a chip that
 * asks is safe even when the answer is a gap.
 *
 * "IT" IS SAFE HERE AND NOWHERE ELSE. These only ever appear under a reply, so
 * the transcript above them already names the piece, and the extraction prompt
 * is told to resolve a follow-up against the conversation so far — the same
 * way it resolves "is it available?" typed by hand. The starters below cannot
 * rely on that, because nothing has been said yet.
 */
const PRODUCT_FOLLOW_UPS = [
  "What is it made of?",
  "Can you make it in a different size?",
  "Is it in stock?",
  HOW_TO_ORDER,
];

/**
 * The product modal's opening chips, for the state that should not happen.
 *
 * The modal asks seedMessage(productName) from the click that opens it, so it
 * normally arrives with a question already in flight and this state is never
 * seen. It is written for the case where that did not run.
 *
 * WHICH IS WHY EVERY ONE OF THESE NAMES THE PIECE. With no transcript there is
 * nothing for "it" to refer to, and a bare "What is it made of?" sent as the
 * first message of a conversation would search the catalogue for nothing in
 * particular and get an answer about whatever came back. Grounded, still — the
 * pipeline does not care how the question was phrased — but about the wrong
 * furniture, which is its own kind of wrong. The first chip is the seed
 * question itself, so tapping it puts the conversation back where opening the
 * modal should have put it.
 */
function productStarters(productName: string) {
  return [
    `Tell me about the ${productName}`,
    `What is the ${productName} made of?`,
    HOW_TO_ORDER,
  ];
}

/**
 * A category name dropped into the middle of a sentence.
 *
 * Every category in this catalogue is a plural noun — Sofas, Beds, Tables,
 * Chairs, Office Sets — so "other office sets" reads correctly. Only a plainly
 * capitalised word is lowered, so a future "3D Wall Panels" or "PVC Panels"
 * keeps the shop's own spelling instead of becoming "3d wall panels". Same
 * rule, and same reason, as midSentence() in lib/messages.ts.
 */
function midSentence(name: string) {
  return name
    .split(" ")
    .map((word) => (/^[A-Z][a-z]+$/.test(word) ? word.toLowerCase() : word))
    .join(" ");
}

/** What to show before anything has been asked. */
export function starterSuggestions(scope: ChatScope): string[] {
  return scope.kind === "product"
    ? productStarters(scope.productName)
    : SITE_STARTERS;
}

/**
 * What to show under the newest reply.
 *
 * Selection is a pure function of what the server already returned, so it
 * cannot describe a catalogue that does not exist: the category chip is built
 * from a row's own `categoryName`, and it only appears when a row came back.
 */
export function followUpSuggestions(
  scope: ChatScope,
  context: ReplyContext,
  /** Everything the customer has already asked, so nothing is offered twice. */
  asked: string[] = [],
): string[] {
  const chips =
    scope.kind === "product" ? PRODUCT_FOLLOW_UPS : siteFollowUps(context);

  const seen = new Set(asked.map((text) => text.trim().toLowerCase()));

  return chips.filter((chip) => !seen.has(chip.toLowerCase())).slice(0, 3);
}

function siteFollowUps(context: ReplyContext): string[] {
  // Nothing was retrieved and the question was not about products: they asked
  // about the shop. Point at what else the assistant can do rather than
  // repeating the question they just asked.
  if (context.topic === "BUSINESS") {
    return [CUSTOM_ORDERS, IN_STOCK, HOW_TO_ORDER];
  }

  if (context.products.length === 0) {
    // Either an off-topic message, or a real search that found nothing. Both
    // want the same thing next: the catalogue is not the whole workshop.
    return [CUSTOM_ORDERS, IN_STOCK, SHOWROOM];
  }

  // A row came back, so its category is a real one and worth offering.
  //
  // THE CITED PRODUCT, NOT THE FIRST RETRIEVED ONE. Retrieval returns a ranked
  // set and the reply usually discusses a subset of it — a live run against
  // "What sofas do you have?" matched six rows, answered about the one sofa
  // among them, and this chip offered "other chairs" because a chair happened
  // to rank first. The lead citation is the piece the customer is actually
  // reading about, and the piece whose card sits directly above these chips.
  // Falling back to the first row covers a grounded reply that cited nothing.
  const lead =
    context.products.find((product) => product.ref === context.citations[0]) ??
    context.products[0]!;

  const category = lead.categoryName;

  return [
    `Do you have other ${midSentence(category)}?`,
    CHEAPER,
    MAKE_TO_SIZE,
    HOW_TO_ORDER,
  ];
}
