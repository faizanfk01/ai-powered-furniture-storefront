/**
 * Quick-reply chips: are they safe, and do they go where a typed message goes?
 *
 *   npx tsx scripts/test-suggestions.tsx            # pure + render, no network
 *   npx tsx scripts/test-suggestions.tsx --live     # + real Groq, real database
 *
 * WHAT IS ACTUALLY AT RISK HERE. Not injection and not grounding: a chip is an
 * INPUT, and lib/ai/grounding.ts checks OUTPUTS, so a chip cannot weaken it —
 * every chip is retrieved and checked exactly as a typed message is, because
 * it IS a typed message by the time it leaves the component.
 *
 * The risk is upstream of all that, and the grounding check will never see it:
 * a chip whose PREMISE is false. "Do you offer free delivery?" is not a
 * neutral question, it is an advertisement for a service nobody said we
 * provide, and the honest grounded answer that follows arrives too late to
 * unask it. So section B is an audit of the chip vocabulary against the things
 * this business has not said.
 *
 * Section D proves the routing claim structurally rather than by assertion:
 * there is one fetch in the client chat path and it points at /api/chat.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";

import { ChatConversation } from "../components/chat/chat-conversation";
import {
  followUpSuggestions,
  starterSuggestions,
  type ChatScope,
  type ReplyContext,
} from "../components/chat/suggestions";
import type { ChatProduct } from "../lib/ai/facts";
import { significantFiguresIn } from "../lib/ai/grounding";
import { WHATSAPP_DISPLAY } from "../lib/site";

// ---------------------------------------------------------------------------

type Check = { label: string; pass: boolean; detail?: string };

const ok = (label: string, pass: boolean, detail?: string): Check => ({
  label,
  pass,
  ...(detail ? { detail } : {}),
});

let failures = 0;

function report(name: string, checks: Check[]) {
  const failed = checks.filter((check) => !check.pass);
  console.log(`\n  ${failed.length === 0 ? "PASS" : "FAIL"}  ${name}`);
  for (const check of checks) {
    console.log(
      `    ${check.pass ? "[ok]  " : "[FAIL]"} ${check.label}${check.detail ? `  -> ${check.detail}` : ""}`,
    );
  }
  failures += failed.length;
}

const PRODUCT = "Karachi 3-Seater Fabric Sofa";
const SITE: ChatScope = { kind: "site" };
const PRODUCT_SCOPE: ChatScope = { kind: "product", productName: PRODUCT };

function row(ref: number, name: string, categoryName: string): ChatProduct {
  return {
    ref,
    id: `prod-${ref}`,
    name,
    slug: `prod-${ref}`,
    href: `/products/prod-${ref}`,
    price: 100000,
    priceLabel: "Rs 100,000",
    stockStatus: "IN_STOCK",
    stockLabel: "In stock",
    categoryName,
    dimensions: null,
    imageUrl: null,
  };
}

/** The five real categories in this catalogue, plus two future-shaped ones. */
const CATEGORIES = ["Sofas", "Beds", "Tables", "Chairs", "Office Sets", "PVC Panels", "3D Wallpapers"];

const CONTEXTS: [string, ReplyContext][] = [
  ["products found (Sofas)", { products: [row(1, "A sofa", "Sofas")], citations: [1], topic: "PRODUCTS" }],
  ["products found (Office Sets)", { products: [row(1, "A desk", "Office Sets")], citations: [1], topic: "PRODUCTS" }],
  ["a product search that matched nothing", { products: [], citations: [], topic: "PRODUCTS" }],
  ["a question about the business", { products: [], citations: [], topic: "BUSINESS" }],
  ["an off-topic message", { products: [], citations: [], topic: "OFF_TOPIC" }],
];

/** Every chip the module can produce, across every scope and situation. */
function everyChip(): string[] {
  const all = [
    ...starterSuggestions(SITE),
    ...starterSuggestions(PRODUCT_SCOPE),
    ...CONTEXTS.flatMap(([, context]) => followUpSuggestions(SITE, context)),
    ...CONTEXTS.flatMap(([, context]) => followUpSuggestions(PRODUCT_SCOPE, context)),
    ...CATEGORIES.flatMap((category) =>
      followUpSuggestions(SITE, { products: [row(1, "X", category)], citations: [1], topic: "PRODUCTS" }),
    ),
  ];

  return [...new Set(all)];
}

// ---------------------------------------------------------------------------
// A. Selection
// ---------------------------------------------------------------------------

function selectionSuite() {
  console.log(`\n=== A. WHICH CHIPS APPEAR ===`);

  console.log(`\n  Empty state, drawer:`);
  for (const chip of starterSuggestions(SITE)) console.log(`    · ${chip}`);
  console.log(`\n  Empty state, product modal (${PRODUCT}):`);
  for (const chip of starterSuggestions(PRODUCT_SCOPE)) console.log(`    · ${chip}`);

  for (const [label, context] of CONTEXTS) {
    console.log(`\n  After a reply — drawer, ${label}:`);
    for (const chip of followUpSuggestions(SITE, context)) console.log(`    · ${chip}`);
  }

  console.log(`\n  After a reply — product modal:`);
  for (const chip of followUpSuggestions(PRODUCT_SCOPE, CONTEXTS[0]![1])) {
    console.log(`    · ${chip}`);
  }

  const counts = [
    starterSuggestions(SITE),
    starterSuggestions(PRODUCT_SCOPE),
    ...CONTEXTS.map(([, context]) => followUpSuggestions(SITE, context)),
    ...CONTEXTS.map(([, context]) => followUpSuggestions(PRODUCT_SCOPE, context)),
  ];

  report("every state offers two or three chips", [
    ok(
      "never fewer than two, never more than three",
      counts.every((set) => set.length >= 2 && set.length <= 3),
      counts.map((set) => set.length).join(", "),
    ),
    ok("no duplicates within a set", counts.every((set) => new Set(set).size === set.length)),
    ok("no empty chip text", counts.flat().every((chip) => chip.trim().length > 0)),
  ]);

  report("chips are contextual in the ways that matter", [
    ok(
      "a Sofas result offers other sofas, in the shop's own category name",
      followUpSuggestions(SITE, CONTEXTS[0]![1]).includes("Do you have other sofas?"),
      followUpSuggestions(SITE, CONTEXTS[0]![1])[0],
    ),
    ok(
      "an Office Sets result offers other office sets",
      followUpSuggestions(SITE, CONTEXTS[1]![1]).includes("Do you have other office sets?"),
      followUpSuggestions(SITE, CONTEXTS[1]![1])[0],
    ),
    ok(
      "a category with an acronym keeps the shop's spelling",
      followUpSuggestions(SITE, {
        products: [row(1, "X", "PVC Panels")],
        citations: [1],
        topic: "PRODUCTS",
      }).includes("Do you have other PVC panels?"),
      followUpSuggestions(SITE, { products: [row(1, "X", "PVC Panels")], citations: [1], topic: "PRODUCTS" })[0],
    ),
    ok(
      "no category chip when nothing was retrieved",
      CONTEXTS.filter(([, context]) => context.products.length === 0).every(
        ([, context]) =>
          !followUpSuggestions(SITE, context).some((chip) => chip.startsWith("Do you have other")),
      ),
    ),
    ok(
      "a business question is not answered with another business question",
      !followUpSuggestions(SITE, CONTEXTS[3]![1]).includes("Where is your showroom?"),
    ),
    ok(
      "the product modal talks about the piece, not the catalogue",
      followUpSuggestions(PRODUCT_SCOPE, CONTEXTS[0]![1]).includes("What is it made of?"),
    ),
    ok(
      "product-modal STARTERS name the piece, because no history exists yet",
      starterSuggestions(PRODUCT_SCOPE)
        .filter((chip) => /\bit\b/.test(chip))
        .length === 0,
      starterSuggestions(PRODUCT_SCOPE).join(" | "),
    ),
    ok(
      "the first product starter is the seed question, so context is recovered",
      starterSuggestions(PRODUCT_SCOPE)[0] === `Tell me about the ${PRODUCT}`,
    ),
  ]);

  const asked = ["Do you have anything cheaper?", "how do i place an order?"];
  const afterAsking = followUpSuggestions(SITE, CONTEXTS[0]![1], asked);

  report("a question already asked is not offered again", [
    ok("the exact repeat is gone", !afterAsking.includes("Do you have anything cheaper?")),
    ok("the case-insensitive repeat is gone", !afterAsking.includes("How do I place an order?")),
    ok("something is still offered", afterAsking.length >= 2, afterAsking.join(" | ")),
  ]);
}

// ---------------------------------------------------------------------------
// B. The premise audit — the only real risk in this feature
// ---------------------------------------------------------------------------

/**
 * Subjects this business has never made a claim about. A chip that raises one
 * is putting words in the shop's mouth, whatever the assistant then answers.
 *
 * `hours` is a leftover from when HOURS.confirmed was false and facts.ts told
 * the model it did not know them. They are confirmed now, so an hours chip
 * would be safe — the pattern stays because no such chip has been written, and
 * this file should fail loudly if one appears without that decision being made.
 */
const FORBIDDEN_PREMISE = [
  ["delivery or shipping", /\b(deliver|delivery|shipping|courier|ship it)\b/i],
  ["a charge or a fee", /\b(fee|charge|charges|free)\b/i],
  ["warranty or guarantee", /\b(warrant|guarantee|guaranty)\b/i],
  ["returns or refunds", /\b(return|refund|exchange it)\b/i],
  ["discounts or sales", /\b(discount|sale|offer|deal|cheap deal|bargain)\b/i],
  ["opening hours", /\b(open|opening|hours|timing|closed|today)\b/i],
  ["payment, instalments or cards", /\b(pay|payment|instal|emi|card|cash on)\b/i],
  ["stock counts", /\bhow many\b/i],
] as const;

/**
 * The field names declared on ReplyContext.
 *
 * `[^}]` already spans newlines, so no dotAll flag is needed — and this repo's
 * tsconfig target rejects one.
 */
function replyContextFields(source: string): string[] {
  const body = source.match(/export type ReplyContext = \{([^}]*)\}/)?.[1] ?? "";

  return [...body.matchAll(/^\s+(\w+)\??:/gm)].map((match) => match[1]!);
}

/** The field names ChatConversation actually hands to followUpSuggestions(). */
function callSiteFields(source: string): string[] {
  const call = source.match(/followUpSuggestions\(\s*scope,\s*\{([^}]*)\}/)?.[1] ?? "";

  return [...call.matchAll(/(\w+):/g)].map((match) => match[1]!);
}

function premiseSuite() {
  console.log(`\n=== B. PREMISE AUDIT ===`);

  const chips = everyChip();
  console.log(`\n  ${chips.length} distinct chips across every scope and situation:`);
  for (const chip of chips) console.log(`    · ${chip}`);

  report("no chip asserts something the business has not said", [
    ...FORBIDDEN_PREMISE.map(([subject, pattern]) =>
      ok(
        `nothing mentions ${subject}`,
        chips.every((chip) => !pattern.test(chip)),
        chips.filter((chip) => pattern.test(chip)).join(" | ") || undefined,
      ),
    ),
    ok(
      "every chip is a question or a plain request, not a claim",
      chips.every((chip) => chip.endsWith("?") || chip.startsWith("Tell me") || chip.startsWith("Show me")),
      chips.filter((chip) => !chip.endsWith("?") && !chip.startsWith("Tell me") && !chip.startsWith("Show me")).join(" | ") || undefined,
    ),
    ok(
      "chips are short enough to tap on a phone",
      chips.every((chip) => chip.length <= 70),
      chips.filter((chip) => chip.length > 70).join(" | ") || undefined,
    ),
  ]);

  // The chip text is either authored in suggestions.ts or built from a
  // category name that came out of a row. Nothing else can produce one.
  const source = readFileSync("components/chat/suggestions.ts", "utf8");

  const conversation = readFileSync("components/chat/chat-conversation.tsx", "utf8");
  const interpolations = [...source.matchAll(/\$\{([^}]+)\}/g)].map((match) =>
    match[1]!.trim(),
  );

  report("chip text can only come from two places", [
    ok(
      "suggestions.ts imports nothing at runtime",
      !/^import (?!type )/m.test(source),
      /^import (?!type )/m.test(source)
        ? [...source.matchAll(/^import .*$/gm)].map((m) => m[0]).join(" | ")
        : undefined,
    ),
    ok(
      "the only things interpolated into a chip are a category name and a product name",
      interpolations.every((expression) =>
        ["midSentence(category)", "productName"].includes(expression),
      ),
      interpolations.join(" | "),
    ),
    // The strongest version of "the model cannot write a chip": the module is
    // never given the model's words in the first place. followUpSuggestions()
    // takes rows and a topic string the API classified — there is no parameter
    // a reply could arrive through.
    ok(
      "the reply text is never passed to the suggestions module at all",
      replyContextFields(source).every((field) =>
        ["products", "citations", "topic"].includes(field),
      ),
      replyContextFields(source).join(", "),
    ),
    ok(
      "and the call site passes exactly those fields, nothing else",
      callSiteFields(conversation).join(",") === "products,citations,topic",
      callSiteFields(conversation).join(", "),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// C. The rendered panel
// ---------------------------------------------------------------------------

function renderSuite() {
  console.log(`\n=== C. RENDERED PANEL (real ChatConversation) ===`);

  const drawer = renderToStaticMarkup(
    <ChatConversation
      active
      scope={SITE}
      emptyState={() => <p>intro copy</p>}
      placeholder="Ask about a piece, a budget, or how to order"
      inputLabel="Ask a question about our furniture"
    />,
  );

  const modal = renderToStaticMarkup(
    <ChatConversation
      active
      scope={PRODUCT_SCOPE}
      emptyState={() => <p>intro copy</p>}
      placeholder={`Ask about the ${PRODUCT}`}
      inputLabel={`Ask a question about the ${PRODUCT}`}
    />,
  );

  const chipButtons = (html: string) =>
    [...html.matchAll(/<button type="button"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]!);

  console.log(`\n  Drawer empty state renders these buttons:`);
  for (const chip of chipButtons(drawer)) console.log(`    · ${chip}`);
  console.log(`\n  Product modal empty state renders these buttons:`);
  for (const chip of chipButtons(modal)) console.log(`    · ${chip}`);

  report("both surfaces show chips on the empty state", [
    ok("the drawer renders three", chipButtons(drawer).length === 3, `${chipButtons(drawer).length}`),
    ok("the modal renders three", chipButtons(modal).length === 3, `${chipButtons(modal).length}`),
    ok(
      "they are real <button> elements, not links",
      !drawer.includes('<a href="#"') && chipButtons(drawer).length > 0,
    ),
    ok(
      "the modal's chips are about the piece",
      chipButtons(modal).every((chip) => chip.includes(PRODUCT) || chip === "How do I place an order?"),
    ),
    ok("the drawer's chips are the site starters", chipButtons(drawer).includes("What sofas do you have?")),
    ok('the empty state keeps its "Try asking" label', drawer.includes("Try asking")),
    ok(
      "chips are sized for a thumb (min-h-10 = 40px)",
      drawer.includes("min-h-10"),
    ),
    ok("chips wrap rather than scroll off the edge", drawer.includes("flex-wrap")),
    ok("the composer is still there", drawer.includes('placeholder="Ask about a piece, a budget, or how to order"')),
    ok(
      "the WhatsApp line is still there in every state",
      drawer.includes("To order, or to check a price, message us on"),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// D. Routing — no new backend path
// ---------------------------------------------------------------------------

function routingSuite() {
  console.log(`\n=== D. ROUTING ===`);

  const conversation = readFileSync("components/chat/chat-conversation.tsx", "utf8");
  const chips = readFileSync("components/chat/suggestion-chips.tsx", "utf8");
  const client = readFileSync("lib/chat-client.ts", "utf8");

  const fetchTargets = [...client.matchAll(/fetch\(\s*"([^"]+)"/g)].map((m) => m[1]!);

  report("a chip is a message, not a new path", [
    ok(
      "the chip row has no fetch, no href and no API knowledge of its own",
      !/fetch\(|href=|\/api\//.test(chips),
    ),
    ok(
      "onPick is wired to the same send() the composer calls",
      (conversation.match(/onPick=\{\(prompt\) => void send\(prompt, entries\)\}/g) ?? []).length === 2,
      `${(conversation.match(/onPick=\{\(prompt\) => void send\(prompt, entries\)\}/g) ?? []).length} of 2 chip rows`,
    ),
    ok(
      "the composer form calls the same send()",
      conversation.includes("if (!overLimit) void send(draft, entries);"),
    ),
    ok(
      "there is exactly one fetch in the client chat path",
      fetchTargets.length === 1,
      fetchTargets.join(", "),
    ),
    ok("and it points at /api/chat", fetchTargets[0] === "/api/chat"),
    ok(
      "send() still refuses to run while a reply is in flight",
      conversation.includes("if (!trimmed || pending) return;"),
    ),
    ok(
      "the grounding-bearing fields are still read from the response",
      conversation.includes("citations: result.data.citations") &&
        conversation.includes("products: result.data.products"),
    ),
  ]);
}

// ---------------------------------------------------------------------------
// E. Live — a chip really is a grounded query (opt-in, spends Groq quota)
// ---------------------------------------------------------------------------

async function liveSuite() {
  const { runChat } = await import("../lib/ai/chat");
  const { db } = await import("../lib/db");

  console.log(`\n=== E. LIVE — every chip through the real pipeline ===`);
  console.log(`  real Groq, real database. This spends free-tier quota.`);

  const catalogue = new Map(
    (await db.product.findMany({ select: { id: true, name: true, price: true } })).map(
      (product) => [product.id, product],
    ),
  );

  // The drawer's three starters: what a customer actually taps first.
  const chips = starterSuggestions(SITE);

  for (const chip of chips) {
    const result = await runChat({ message: chip, history: [] });

    if (!result.ok) {
      report(`chip: "${chip}"`, [
        ok(`reached the pipeline (Groq said ${result.failure.kind})`, false, result.failure.kind),
      ]);
      continue;
    }

    console.log(`\n${"-".repeat(78)}`);
    console.log(`Chip tapped: ${chip}`);
    console.log(`Topic: ${result.retrieval.topic}   matched: ${result.retrieval.matched}   grounded: ${result.grounded}`);
    console.log(`Reply:\n${result.reply.split("\n").map((line) => `  ${line}`).join("\n")}`);
    console.log(`Next chips: ${followUpSuggestions(SITE, {
        products: result.products,
        citations: result.citations,
        topic: result.retrieval.topic,
      }).join("  |  ")}`);

    report(`chip: "${chip}"`, [
      ok("the model's own reply passed the grounding check", result.grounded === true),
      ok(
        "every product returned is a real row at its real price",
        result.products.every((product) => {
          const real = catalogue.get(product.id);
          return real && real.name === product.name && real.price === product.price;
        }),
        `${result.products.length} product(s)`,
      ),
      ok(
        "every citation points inside the retrieved set",
        result.citations.every((ref) => result.products.some((product) => product.ref === ref)),
      ),
      // Mirrors checkGrounding's own allow-list rather than a stricter one.
      // A chip carrying a budget ("Show me tables under Rs 30,000") is the
      // customer's own sentence, and the reply is entitled to quote it back —
      // that is the documented reason userText is whitelisted. An assertion
      // that allowed only row prices failed this on the first live run, and
      // the code was right.
      ok(
        "every figure is a real price, the chip's own budget, or the shop's number",
        (() => {
          const allowed = new Set<number>([
            ...[...catalogue.values()].map((product) => product.price),
            ...significantFiguresIn(chip),
            ...significantFiguresIn(WHATSAPP_DISPLAY),
          ]);
          return [...result.reply.matchAll(/Rs\s*([\d,]+)/g)]
            .map((match) => Number(match[1]!.replace(/,/g, "")))
            .every((value) => allowed.has(value));
        })(),
      ),
      ok("a follow-up chip set is available for the next tap", true),
    ]);
  }

  await db.$disconnect();
}

// ---------------------------------------------------------------------------

async function main() {
  selectionSuite();
  premiseSuite();
  renderSuite();
  routingSuite();

  if (process.argv.includes("--live")) await liveSuite();
  else console.log(`\n  (skipping the live suite — pass --live, needs GROQ_API_KEY and DATABASE_URL)`);

  console.log(`\n${"=".repeat(78)}`);
  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
