/**
 * Markdown replies: does the grounding check still hold, and is the renderer
 * safe?
 *
 *   npx tsx scripts/test-markdown.tsx
 *
 * No server, no database, no Groq key. Everything here is a pure function call
 * against lib/ai/grounding.ts and a real React render of
 * components/chat/chat-reply.tsx, which is why it can run in CI and in a
 * pre-commit hook where scripts/test-chat.ts cannot.
 *
 * WHAT IT IS FOR. Allowing the model to format its replies added exactly one
 * class of risk, and it is not a rendering risk — it is that markdown
 * characters land INSIDE the strings the grounding check reads, and split a
 * fabricated price or an out-of-range citation into pieces the check no longer
 * recognises. `**45**,**000**` is the whole problem in one token: two numbers
 * under the significant-figure floor where there was one fabricated price.
 *
 * So section A is the important one. It asserts that every way of hiding a lie
 * inside markdown is still caught, AND that a correctly formatted honest reply
 * is still accepted — a check that rejects everything proves nothing.
 *
 * Section B asserts the renderer cannot be turned into an injection vector,
 * against real rendered HTML rather than against the token tree, because the
 * claim being made is about what reaches the browser.
 */
import "dotenv/config";

import { renderToStaticMarkup } from "react-dom/server";

import { ChatReply } from "../components/chat/chat-reply";
import { parseMarkdown } from "../components/chat/markdown";
import type { ChatProduct } from "../lib/ai/facts";
import {
  checkGrounding,
  fallbackReply,
  normaliseCitations,
  withNamedProducts,
} from "../lib/ai/grounding";

// ---------------------------------------------------------------------------
// Harness
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

// ---------------------------------------------------------------------------
// The world these tests run in — two real-shaped rows and the fact block the
// model would have been shown for them.
// ---------------------------------------------------------------------------

const PRODUCTS: ChatProduct[] = [
  {
    ref: 1,
    id: "prod-1",
    name: "Karachi 3-Seater Fabric Sofa",
    slug: "karachi-3-seater-fabric-sofa",
    href: "/products/karachi-3-seater-fabric-sofa",
    price: 118000,
    priceLabel: "Rs 118,000",
    stockStatus: "IN_STOCK",
    stockLabel: "In stock",
    categoryName: "Sofas",
    dimensions: '84" W x 36" D x 30" H',
    imageUrl: null,
  },
  {
    ref: 2,
    id: "prod-2",
    name: "Swat Two-Seater Sofa",
    slug: "swat-two-seater-sofa",
    href: "/products/swat-two-seater-sofa",
    price: 96000,
    priceLabel: "Rs 96,000",
    stockStatus: "MADE_TO_ORDER",
    stockLabel: "Made to order",
    categoryName: "Sofas",
    dimensions: '62" W x 34" D x 30" H',
    imageUrl: null,
  },
];

const FACTS = [
  "BUSINESS: Standard Furniture, a furniture and interior decor business in Mardan.",
  "HOW TO ORDER: every enquiry, quote and order happens over WhatsApp on +92 300 905 9052.",
  'PRODUCT [P1]: Karachi 3-Seater Fabric Sofa. Sofas. Rs 118,000. In stock. 84" W x 36" D x 30" H. Sheesham frame, woven fabric.',
  'PRODUCT [P2]: Swat Two-Seater Sofa. Sofas. Rs 96,000. Made to order. 62" W x 34" D x 30" H.',
].join("\n");

const QUESTION = "What sofas do you have?";

/** The pipeline as lib/ai/chat.ts runs it: normalise, then check. */
function verdictFor(rawReply: string, userText = QUESTION) {
  const reply = normaliseCitations(rawReply);
  return { reply, verdict: checkGrounding(reply, FACTS, userText, PRODUCTS) };
}

const rejected = (rawReply: string, userText?: string) =>
  verdictFor(rawReply, userText).verdict.grounded === false;

// ---------------------------------------------------------------------------
// A. Grounding still holds when the lie is wearing markdown
// ---------------------------------------------------------------------------

function groundingSuite() {
  console.log(`\n=== A. GROUNDING UNDER MARKDOWN ===`);
  console.log(
    `\n  Retrieved for this turn: [P1] ${PRODUCTS[0]!.name} (${PRODUCTS[0]!.priceLabel}), ` +
      `[P2] ${PRODUCTS[1]!.name} (${PRODUCTS[1]!.priceLabel})`,
  );

  // --- The baseline the phase already had, restated so a regression here is
  //     visible rather than inferred.
  report("plain-text hallucination is still rejected (baseline)", [
    ok(
      "invented citation [P9]",
      rejected("The Milano Recliner [P9] is Rs 45,000."),
      verdictFor("The Milano Recliner [P9] is Rs 45,000.").verdict.grounded
        ? "ACCEPTED"
        : (verdictFor("The Milano Recliner [P9] is Rs 45,000.").verdict as { reason: string }).reason,
    ),
    ok("invented price on a real product", rejected("The [P1] is Rs 45,000.")),
    ok("fullwidth 【P9】 is normalised then rejected", rejected("The Milano 【P9】 is nice.")),
    ok(
      "zero-width space inside the tag is stripped then rejected",
      rejected("The Milano [​P9] is nice."),
    ),
  ]);

  // --- The new surface. Each of these is a lie the pre-markdown check would
  //     have missed, because the markers break the token the check looks for.
  const bypasses: [string, string][] = [
    ["citation bolded: [**P9**]", "The **Milano Recliner** [**P9**] is one of our best sellers."],
    ["citation italicised: [*P9*]", "The Milano Recliner [*P9*] is lovely."],
    ["citation backticked: [`P9`]", "The Milano Recliner [`P9`] is lovely."],
    ["price bolded whole: **Rs 45,000**", "The [P1] is yours at **Rs 45,000**."],
    ["price split across bold runs: **45**,**000**", "The [P1] is yours at Rs **45**,**000**."],
    ["price split with italics: *45*,*000*", "The [P1] is yours at Rs *45*,*000*."],
    ["price inside code span: `45,000`", "The [P1] is yours at Rs `45,000`."],
    ["price in a bulleted list", "Sofas we have:\n- **Milano Recliner** [P1], Rs **45,000**"],
    [
      "price split inside a bold list item",
      "Sofas we have:\n- **Milano Recliner** [P1], Rs **45**,**000**, in stock",
    ],
    ["price under a heading", "## Our recliners\n\nThe [P1] is Rs **62**,**000**."],
  ];

  report(
    "markdown cannot hide an invented citation or price",
    bypasses.map(([label, reply]) => {
      const { verdict } = verdictFor(reply);
      return ok(
        label,
        verdict.grounded === false,
        verdict.grounded ? "ACCEPTED — LEAK" : undefined,
      );
    }),
  );

  // --- The other half: a check that rejects everything is not a check.
  const honest: [string, string][] = [
    [
      "bold names, bulleted list, real prices",
      "Here are the sofas we have:\n\n" +
        "- **Karachi 3-Seater Fabric Sofa** [P1], Rs 118,000, in stock\n" +
        "- **Swat Two-Seater Sofa** [P2], Rs 96,000, made to order\n\n" +
        "Message us on WhatsApp to confirm.",
    ],
    ["a bolded real price", "The [P1] is **Rs 118,000** and it is in stock."],
    [
      "a real price split by bold markers",
      "The [P1] is Rs **118**,**000**, in stock right now.",
    ],
    [
      "the shop phone number in bold (the U+202F regression)",
      "Message us on WhatsApp at **+92 300 905 9052** and we will confirm.",
    ],
    [
      "a numbered list of steps",
      "To order:\n\n1. Message us on WhatsApp\n2. We confirm the price\n3. We build it",
    ],
    [
      "a budget the customer themselves named, in bold",
      "Nothing under **Rs 40,000** I am afraid, but the [P2] is Rs 96,000.",
      // userText carries the 40,000 — see the note in checkGrounding().
    ],
  ];

  report(
    "a correctly formatted honest reply is still accepted",
    honest.map(([label, reply]) => {
      const userText =
        label.includes("budget") ? "anything under Rs 40,000?" : QUESTION;
      const { verdict } = verdictFor(reply, userText);
      return ok(
        label,
        verdict.grounded === true,
        verdict.grounded
          ? undefined
          : `REJECTED — ${(verdict as { reason: string }).reason}`,
      );
    }),
  );

  // --- Citations and the product cards they drive.
  const boldCited = verdictFor(
    "- **Karachi 3-Seater Fabric Sofa** [P1], Rs 118,000\n- **Swat Two-Seater Sofa** [P2], Rs 96,000",
  );

  report("citations survive markdown and still drive the cards", [
    ok("[**P1**] normalises to [P1]", normaliseCitations("[**P1**]") === "[P1]"),
    ok("[*P2*] normalises to [P2]", normaliseCitations("[*P2*]") === "[P2]"),
    ok("[P1] is left alone", normaliseCitations("[P1]") === "[P1]"),
    ok(
      "both refs collected from a bulleted reply",
      boldCited.verdict.grounded === true &&
        boldCited.verdict.citations.join(",") === "1,2",
      boldCited.verdict.grounded
        ? boldCited.verdict.citations.join(",")
        : "rejected",
    ),
    ok(
      "an untagged product named inside bold still gets its card",
      withNamedProducts("The **Karachi** 3-Seater Fabric Sofa is lovely.", [], PRODUCTS).join(
        ",",
      ) === "1",
      withNamedProducts("The **Karachi** 3-Seater Fabric Sofa is lovely.", [], PRODUCTS).join(","),
    ),
    ok(
      "a fully bolded product name still gets its card",
      withNamedProducts("**Swat Two-Seater Sofa** is made to order.", [], PRODUCTS).join(
        ",",
      ) === "2",
    ),
  ]);
}

// ---------------------------------------------------------------------------
// B. The renderer, against real HTML
// ---------------------------------------------------------------------------

function render(text: string, products: ChatProduct[] = PRODUCTS) {
  return renderToStaticMarkup(<ChatReply text={text} products={products} />);
}

function rendererSuite() {
  console.log(`\n=== B. RENDERER ===`);

  // --- The shape the whole change is for.
  const multi = render(
    "Here are the sofas we have under Rs 120,000:\n\n" +
      "- **Karachi 3-Seater Fabric Sofa** [P1], Rs 118,000, in stock\n" +
      "- **Swat Two-Seater Sofa** [P2], Rs 96,000, made to order\n\n" +
      "Message us on WhatsApp to confirm and arrange a look.",
  );

  console.log(`\n${"-".repeat(78)}\nMulti-product reply renders as:\n`);
  console.log(textOutline(multi));

  report("a multi-product reply renders as an intro, a list and a close", [
    ok("two paragraphs of prose", (multi.match(/<p>/g) ?? []).length === 2),
    ok("one bulleted list", (multi.match(/<ul /g) ?? []).length === 1),
    ok("two list items", (multi.match(/<li>/g) ?? []).length === 2),
    ok("both names bolded", (multi.match(/<strong /g) ?? []).length === 2),
    ok(
      "both citations became product links",
      multi.includes('href="/products/karachi-3-seater-fabric-sofa"') &&
        multi.includes('href="/products/swat-two-seater-sofa"'),
    ),
    ok("no raw [P1] left in the output", !/\[P\d\]/.test(multi)),
  ]);

  // --- Everything a hostile or confused reply could try.
  const script = render('Hello <script>alert("xss")</script> there.');
  const imgTag = render('<img src=x onerror="alert(1)">');
  const evilLink = render("See [our best offer](https://evil.example/steal) today.");
  const jsLink = render("Click [here](javascript:alert(1)) now.");
  const image = render("![a sofa](https://evil.example/tracker.gif)");
  const bareUrl = render("Visit https://evil.example for more.");
  const htmlAnchor = render('<a href="https://evil.example">click</a>');
  const iframe = render("<iframe src=https://evil.example></iframe>");

  const allHostile = [script, imgTag, evilLink, jsLink, image, bareUrl, htmlAnchor, iframe];

  console.log(`\n${"-".repeat(78)}\nHostile input renders as:\n`);
  console.log(`  <script> reply  ->  ${script}`);
  console.log(`  markdown link   ->  ${evilLink}`);
  console.log(`  markdown image  ->  ${image}`);

  report("markdown is never an injection vector", [
    ok(
      "a script tag is escaped, not emitted",
      script.includes("&lt;script&gt;") && !script.includes("<script"),
    ),
    ok("an img tag is escaped, not emitted", !imgTag.includes("<img")),
    ok("an iframe is escaped, not emitted", !iframe.includes("<iframe")),
    ok("a raw anchor tag is escaped, not emitted", htmlAnchor.includes("&lt;a href=")),
    ok(
      "a markdown link renders its label and drops the address",
      evilLink.includes("our best offer") && !evilLink.includes("evil.example"),
    ),
    ok(
      "a javascript: url never reaches an href",
      !jsLink.includes("javascript:") && jsLink.includes("here"),
    ),
    ok(
      "a markdown image renders alt text and no <img>",
      image.includes("a sofa") && !image.includes("<img") && !image.includes("evil.example"),
    ),
    ok("a bare url is not turned into a link", !bareUrl.includes("<a ")),
    // Asserted against real TAGS rather than against the whole string. An
    // escaped `&lt;img src=x onerror=...&gt;` still contains the characters
    // "onerror=" as inert text, and a check that greps the output cannot tell
    // that from an attribute — it would fail on the very evidence that the
    // escaping worked.
    ok(
      "only a fixed set of elements is ever emitted",
      allHostile
        .concat(multi)
        .flatMap((html) => tagsIn(html).map((tag) => tag.name))
        .every((name) => ALLOWED_TAGS.includes(name)),
      [
        ...new Set(
          allHostile
            .concat(multi)
            .flatMap((html) => tagsIn(html).map((tag) => tag.name))
            .filter((name) => !ALLOWED_TAGS.includes(name)),
        ),
      ].join(", ") || undefined,
    ),
    ok(
      "only class and href attributes are ever emitted",
      allHostile
        .concat(multi)
        .flatMap((html) => tagsIn(html).flatMap((tag) => tag.attributes))
        .every((attribute) => attribute === "class" || attribute === "href"),
      [
        ...new Set(
          allHostile
            .concat(multi)
            .flatMap((html) => tagsIn(html).flatMap((tag) => tag.attributes))
            .filter((attribute) => attribute !== "class" && attribute !== "href"),
        ),
      ].join(", ") || undefined,
    ),
    ok(
      "every href in every output is a site-relative product path",
      allHostile
        .concat(multi)
        .flatMap((html) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!))
        .every((href) => href.startsWith("/products/")),
    ),
  ]);

  // --- Formatting details.
  const dangling = render("A ghost [P9] reference.", PRODUCTS);
  const breaks = render("First line\nSecond line");
  const heading = render("### Sofas\n\nWe have two.");

  report("the restrained subset behaves", [
    ok("bold renders as <strong>", render("**hi**").includes("<strong")),
    ok("italic renders as <em>", render("*hi*").includes("<em")),
    ok("underscore italic renders as <em>", render("_hi_").includes("<em")),
    ok(
      "snake_case is not italicised",
      !render("the field_name_here value").includes("<em"),
    ),
    ok("numbered lists render as <ol>", render("1. one\n2. two").includes("<ol")),
    ok("a single newline becomes a line break", breaks.includes("<br/>")),
    ok("a blank line starts a new paragraph", (render("a\n\nb").match(/<p>/g) ?? []).length === 2),
    ok("a heading renders as a bold lead-in, not an <h3>", !heading.includes("<h3")),
    ok(
      "a citation with no product is dropped silently",
      !dangling.includes("<a ") && !dangling.includes("P9"),
      dangling,
    ),
    ok(
      "a citation inside bold still becomes a link",
      render("**Sofa [P1]**").includes('href="/products/karachi-3-seater-fabric-sofa"'),
    ),
    ok(
      "plain text with no markdown is unchanged",
      render("Just a sentence.").includes("<p>Just a sentence.</p>"),
    ),
  ]);

  // --- The deterministic reply that replaces a rejected one.
  const fallback = fallbackReply(PRODUCTS);
  const fallbackHtml = render(fallback);

  console.log(`\n${"-".repeat(78)}\nThe fallback reply (used when grounding rejects):\n`);
  console.log(fallback.split("\n").map((line) => `  ${line}`).join("\n"));

  report("the deterministic fallback renders as a list too", [
    ok("it is a bulleted list", fallbackHtml.includes("<ul ")),
    ok("one item per product", (fallbackHtml.match(/<li>/g) ?? []).length === PRODUCTS.length),
    ok("both products link out", (fallbackHtml.match(/<a /g) ?? []).length === PRODUCTS.length),
    ok("it still contains no em dash", !fallback.includes("—")),
    ok(
      "every figure in it is a real product price",
      [...fallback.matchAll(/Rs ([\d,]+)/g)]
        .map((m) => Number(m[1]!.replace(/,/g, "")))
        .every((value) => PRODUCTS.some((product) => product.price === value)),
    ),
  ]);

  // --- A structural assertion rather than a behavioural one: there is no
  //     escape hatch in the source at all.
  report("there is no HTML escape hatch on this path", [
    ok(
      "the parser emits only known token kinds",
      parseMarkdown('<b onclick="x">hi</b> **there**')
        .flatMap((block) => (block.kind === "list" ? block.items.flat() : block.children))
        .every((node) =>
          ["text", "break", "code", "citation", "strong", "em"].includes(node.kind),
        ),
    ),
  ]);
}

// ---------------------------------------------------------------------------

/** Everything the renderer is allowed to put in the document. */
const ALLOWED_TAGS = [
  "div",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "br",
  "a",
  "span",
];

/**
 * The real elements in a rendered string, with their attribute names.
 *
 * Only matches an actual `<tag ...>`, so escaped markup — which is what a
 * hostile reply becomes — is invisible to it. That is the point: the question
 * being asked is what the browser will build, not what characters are present.
 */
function tagsIn(html: string): { name: string; attributes: string[] }[] {
  const TAG = /<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=/>]+(?:="[^"]*")?)*)\s*\/?>/g;

  return [...html.matchAll(TAG)].map((match) => ({
    name: match[1]!.toLowerCase(),
    attributes: [...(match[2] ?? "").matchAll(/([^\s=/>]+)(?:="[^"]*")?/g)]
      .map((attribute) => attribute[1]!.toLowerCase())
      .filter(Boolean),
  }));
}

/** Rendered HTML as an indented outline, for reading in a terminal. */
function textOutline(html: string) {
  return html
    .replace(/></g, ">\n<")
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

// ---------------------------------------------------------------------------
// C. The real pipeline (opt-in: needs DATABASE_URL)
// ---------------------------------------------------------------------------

/**
 * `npx tsx scripts/test-markdown.tsx --pipeline`
 *
 * Sections A and B call the checked functions directly. This one calls
 * lib/ai/chat.ts runChat() — real catalogue shape, real SQL retrieval, the
 * real system prompt, the real normalise-then-check sequence — with only Groq
 * swapped for the stub in scripts/groq-stub.ts, which is the seam a fake
 * belongs on.
 *
 * It is the same thing the stub suite in scripts/test-chat.ts proves, minus
 * the HTTP hop, and it needs no second dev server to do it. Worth having
 * separately: `next dev` refuses to start a second instance of this project,
 * so on a machine already running the app the HTTP stub suite cannot be run at
 * all, and this can.
 */
async function pipelineSuite() {
  const { startGroqStub } = await import("./groq-stub");
  const { runChat } = await import("../lib/ai/chat");
  const { db } = await import("../lib/db");

  const stub = await startGroqStub("markdown-grounded", 4611);
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${stub.port}/v1`;
  process.env.GROQ_API_KEY ||= "stub-key";

  console.log(`\n=== C. FULL PIPELINE — real DB, real grounding, stubbed Groq ===`);
  console.log(`\n  stub on 127.0.0.1:${stub.port}, database from DATABASE_URL`);

  const ask = async (mode: Parameters<typeof stub.setMode>[0], message: string) => {
    stub.setMode(mode);
    const result = await runChat({ message, history: [] });
    if (!result.ok) throw new Error(`runChat failed: ${result.failure.kind}`);
    return result;
  };

  // 1. The control, first: if a good markdown reply cannot get through, every
  //    rejection below is meaningless.
  {
    const result = await ask("markdown-grounded", "What sofas do you have?");
    console.log(`\n${"-".repeat(78)}`);
    console.log("Upstream (well-formed markdown, cites [P1], no figures):");
    console.log(`Served:\n${result.reply.split("\n").map((l) => `  ${l}`).join("\n")}`);

    report("a grounded markdown reply passes through untouched", [
      ok("products were retrieved", result.products.length > 0, `${result.products.length}`),
      ok("grounded", result.grounded === true),
      ok("the model's own words were kept", result.reply.includes("Message us on **WhatsApp**")),
      ok("the markdown survived to the client", result.reply.includes("- The sofa above [P1]")),
      ok("the citation was collected", result.citations.includes(1)),
    ]);
  }

  // 2. The emphasised out-of-range citation.
  {
    const result = await ask("hallucinate-markdown", "Do you have a recliner?");
    console.log(`\n${"-".repeat(78)}`);
    console.log("Upstream (fabricated, markdown): ## heading, **Milano Recliner** [**P9**], Rs **45,000**, `62,000`");
    console.log(`Served:\n${result.reply.split("\n").map((l) => `  ${l}`).join("\n")}`);

    report("markdown cannot smuggle a hallucination through the pipeline", [
      ok(
        "real products were retrieved, so the range check was exercised",
        result.products.length > 0,
        `${result.products.length} retrieved`,
      ),
      ok("flagged as NOT grounded", result.grounded === false),
      ok("the invented product name never reaches the reply", !/milano/i.test(result.reply)),
      ok("the invented prices never reach the reply", !/45,?000|62,?000/.test(result.reply)),
      ok("the warranty and delivery claims are gone", !/warranty|delivery/i.test(result.reply)),
      ok("no P9 anywhere in the reply", !/P9/i.test(result.reply)),
      ok(
        "every figure served is a real row price",
        [...result.reply.matchAll(/Rs\s*([\d,]+)/g)]
          .map((match) => Number(match[1]!.replace(/,/g, "")))
          .every((value) => result.products.some((product) => product.price === value)),
      ),
    ]);
  }

  // 3. The valid citation with a price split across bold runs — the figure
  //    check standing on its own.
  {
    const result = await ask("hallucinate-markdown-price", "What sofas do you have?");
    console.log(`\n${"-".repeat(78)}`);
    console.log("Upstream (valid [P1], price split): - **Our sofa** [P1], on offer at Rs **45**,**000**");
    console.log(`Served:\n${result.reply.split("\n").map((l) => `  ${l}`).join("\n")}`);

    report("a price split by markdown is caught by the figure check alone", [
      ok(
        "real products were retrieved, so [P1] was a VALID citation",
        result.products.length > 0,
        `${result.products.length} retrieved`,
      ),
      ok("flagged as NOT grounded", result.grounded === false),
      ok("the invented price never reaches the reply", !/45\s*,?\s*000/.test(result.reply)),
      ok("the invented offer never reaches the reply", !/offer|this week/i.test(result.reply)),
    ]);
  }

  stub.server.close();
  await db.$disconnect();
}

async function main() {
  groundingSuite();
  rendererSuite();

  if (process.argv.includes("--pipeline")) await pipelineSuite();
  else console.log(`\n  (skipping the full-pipeline suite — pass --pipeline, needs DATABASE_URL)`);

  console.log(`\n${"=".repeat(78)}`);
  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
