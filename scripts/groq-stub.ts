/**
 * A stand-in for Groq, for the failure paths that cannot be provoked on demand.
 *
 *   npm run groq-stub          # standalone, port 4599
 *
 * Two of this phase's requirements are about what happens when the model
 * misbehaves — a 429 at the free-tier ceiling, and a reply that invents a
 * product. Waiting for the real API to do either is not a test, and the
 * alternative (a `SIMULATE_429` branch inside lib/ai/groq.ts) means shipping
 * test scaffolding in the code path it is meant to be testing. So the app is
 * pointed at this instead, through the GROQ_BASE_URL it already reads:
 *
 *   GROQ_BASE_URL=http://127.0.0.1:4599/v1 npm run dev
 *
 * Production code is unchanged and unaware. What is being exercised is the
 * real route, the real retrieval and the real grounding check — only the
 * upstream is swapped, which is exactly the seam a fake belongs on.
 *
 * The mode is switched at runtime over POST /control so one stub and one
 * server can cover every scenario in a single test run.
 */
import { createServer, type Server } from "node:http";

import { GROQ_MODELS } from "../lib/ai/groq";

export type StubMode =
  /** Quota exhausted on every model. */
  | "429"
  /**
   * 429 on the answer model only. The truer picture of the free tier: Groq
   * meters per model, and the 70B has a tenth the daily budget of the 8B, so
   * in practice extraction still succeeds and the reply is what fails.
   */
  | "429-answer"
  /** Upstream 503 — the "Groq is down" branch, distinct from rate limiting. */
  | "down"
  /**
   * The adversarial case. The extractor behaves; the answer model returns a
   * reply naming a product that does not exist, quoting a price nobody set,
   * and citing a tag outside the retrieved range. Nothing in the prompt can
   * prevent this — it is what the grounding check is for.
   */
  | "hallucinate"
  /**
   * The same lie, formatted. Once the model is allowed to write markdown, the
   * citation it invents can arrive as `[**P9**]` — which is not the token the
   * range check looks for, so before lib/ai/grounding.ts learned to fold
   * emphasis this reply was never range checked at all.
   */
  | "hallucinate-markdown"
  /**
   * The narrower and nastier one: a REAL citation, so the citation check
   * passes and the figure check is the only thing left standing, and a
   * fabricated price written as `Rs **45**,**000**`. Read without folding,
   * that is 45 and 000 — two numbers below the significant-figure floor where
   * there was one invented price. This mode exists to prove the figure check
   * still fires on the whole number.
   */
  | "hallucinate-markdown-price"
  /**
   * The control. A well-formed markdown reply that cites a real retrieved
   * product and states no figure at all, so it SHOULD pass the grounding check
   * untouched. Without this the markdown tests only prove the check can say
   * no, which any broken check can do.
   */
  | "markdown-grounded";

const DEFAULT_PORT = 4599;

/**
 * What a hallucinating model looks like. Three separate lies, so the test can
 * show which check catches which:
 *   - "Milano Recliner"  — a product name that is in no row
 *   - "Rs 45,000"        — a figure in no fact block
 *   - "[P9]"             — a citation past the end of the retrieved set
 */
const HALLUCINATED_REPLY =
  "Yes — the Milano Recliner [P9] is one of our best sellers at Rs 45,000, and it comes with a 5 year warranty and free delivery across Pakistan within 3 days. We can also do it in Italian leather for Rs 62,000.";

/**
 * The same three lies, wearing markdown, plus every trick the formatting makes
 * available: the citation emphasised so it is not the token the range check
 * matches, and one price inside a code span.
 */
const HALLUCINATED_MARKDOWN_REPLY = [
  "## Our recliners",
  "",
  "Yes — the **Milano Recliner** [**P9**] is one of our best sellers:",
  "",
  "- **Milano Recliner** [**P9**], Rs **45,000**, in stock",
  "- Italian leather option, Rs `62,000`",
  "",
  "It comes with a **5 year warranty** and *free delivery* across Pakistan within 3 days.",
].join("\n");

/**
 * A correctly cited reply about a REAL retrieved product, carrying a price
 * nobody set, split across two bold runs so the digits do not sit together.
 * The citation check has nothing to object to here; the figure check is the
 * only thing between this and a customer.
 */
const HALLUCINATED_MARKDOWN_PRICE_REPLY = [
  "Here is what we have:",
  "",
  "- **Our sofa** [P1], on offer at Rs **45**,**000** this week only",
  "",
  "That price includes *free delivery*.",
].join("\n");

/**
 * Formatted, cited, and true. No figure appears in it, which is what lets a
 * fixed string be grounded against a catalogue this stub knows nothing about.
 */
const GROUNDED_MARKDOWN_REPLY = [
  "Here is what we have on the website:",
  "",
  "- The sofa above [P1], in our showroom now",
  "",
  "Message us on **WhatsApp** to confirm and arrange a look.",
].join("\n");

/** A plausible extraction, so retrieval runs for real in hallucinate mode. */
const STUB_EXTRACTION = JSON.stringify({
  topic: "PRODUCTS",
  search: "sofa",
  category: null,
  priceMin: null,
  priceMax: null,
  stockStatus: null,
});

function completion(content: string) {
  return {
    id: "stub",
    object: "chat.completion",
    model: "stub",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

async function readBody(request: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export function startGroqStub(
  initialMode: StubMode = "429",
  port = Number(process.env.GROQ_STUB_PORT ?? DEFAULT_PORT),
): Promise<{ server: Server; port: number; setMode: (mode: StubMode) => void }> {
  let mode: StubMode = initialMode;

  const server = createServer((request, response) => {
    void (async () => {
      const url = request.url ?? "/";
      const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
        response.writeHead(status, { "content-type": "application/json", ...headers });
        response.end(JSON.stringify(body));
      };

      if (url === "/control" && request.method === "POST") {
        mode = JSON.parse(await readBody(request)).mode as StubMode;
        return json(200, { mode });
      }

      if (!url.endsWith("/chat/completions")) return json(404, { error: "not found" });

      const body = JSON.parse(await readBody(request)) as { model?: string };

      // Compared against the real constant rather than a substring of a model
      // name. An earlier version matched on "8b", which silently stopped
      // identifying the extractor the moment the model changed — the stub then
      // fed the hallucinated prose to BOTH calls, extraction fell back, and the
      // hallucination test started passing against an empty product set
      // instead of proving the citation range check. It still went green,
      // which is the worst way for a test to break.
      const isAnswerModel = body.model !== GROQ_MODELS.extract;

      if (mode === "429" || (mode === "429-answer" && isAnswerModel)) {
        // Shaped like Groq's own rate-limit response, `retry-after` included,
        // because parsing that header is part of what is under test.
        return json(
          429,
          {
            error: {
              message:
                "Rate limit reached for model `llama-3.3-70b-versatile` in organization `org_stub` on tokens per minute (TPM): Limit 12000, Used 12000.",
              type: "tokens",
              code: "rate_limit_exceeded",
            },
          },
          { "retry-after": "7" },
        );
      }

      if (mode === "down") {
        return json(503, { error: { message: "Service Unavailable", type: "server_error" } });
      }

      if (!isAnswerModel) return json(200, completion(STUB_EXTRACTION));

      const reply =
        mode === "hallucinate-markdown"
          ? HALLUCINATED_MARKDOWN_REPLY
          : mode === "hallucinate-markdown-price"
            ? HALLUCINATED_MARKDOWN_PRICE_REPLY
            : mode === "markdown-grounded"
              ? GROUNDED_MARKDOWN_REPLY
              : HALLUCINATED_REPLY;

      return json(200, completion(reply));
    })();
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({ server, port, setMode: (next: StubMode) => (mode = next) }),
    );
  });
}

// Standalone: `npm run groq-stub`. When imported by the test runner this block
// does not run, and the stub is started and stopped in-process instead.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/groq-stub.ts")) {
  const mode = (process.env.GROQ_STUB_MODE as StubMode | undefined) ?? "429";
  void startGroqStub(mode).then(({ port }) => {
    console.log(`groq stub listening on http://127.0.0.1:${port}/v1 (mode: ${mode})`);
    console.log(`switch mode:  curl -X POST http://127.0.0.1:${port}/control -d '{"mode":"down"}'`);
  });
}
