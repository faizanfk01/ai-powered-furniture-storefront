/**
 * The Groq HTTP client.
 *
 * Deliberately `fetch` against Groq's OpenAI-compatible endpoint rather than
 * the `groq-sdk` package. Three reasons, in order of weight:
 *
 *   1. The 429 path is the one this phase has to get right, and it needs the
 *      raw `retry-after` header. Going through an SDK that turns a rate limit
 *      into a thrown error class means reading the header back out of an
 *      exception — more indirection for the code path that matters most.
 *   2. Zero new dependencies in a locked stack (CLAUDE.md → Stack).
 *   3. `GROQ_BASE_URL` below is trivially redirectable at a local stub, which
 *      is how the rate-limit and hallucination tests in scripts/test-chat.ts
 *      run without a test hook in production code.
 *
 * Nothing here throws. Every failure comes back as a discriminated result, so
 * a caller cannot forget to handle "the AI is down" — the type will not let it
 * read `.content` without narrowing first. Same shape as readJson() in
 * lib/api.ts.
 */

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------
//
// READ THIS BEFORE CHANGING A MODEL ID. Groq's published model list and the
// model list this account can actually reach are two different things, and on
// 2026-08-27 they disagreed: the docs still advertised llama-3.3-70b-versatile
// and llama-3.1-8b-instant as current production models, and both returned
//
//   404 {"code":"model_not_found","message":"The model
//        `llama-3.3-70b-versatile` does not exist or you do not have access"}
//
// Meta has no chat model left on this account — only the prompt-guard
// classifiers. So the source of truth is the API, not the documentation:
//
//   curl -H "Authorization: Bearer $GROQ_API_KEY" \
//        https://api.groq.com/openai/v1/models
//
// NOTE FOR CLAUDE.md: the stack there says "Groq (Llama) for AI chat". Groq is
// unchanged; Llama is no longer on offer. The provider decision stands, the
// model within it could not.
//
// WHAT IS AVAILABLE, and why these two. Of the text models this account can
// reach — openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.6-27b,
// qwen/qwen3.8-27b, groq/compound, groq/compound-mini — the compound systems
// are disqualified outright: they carry built-in web search and code
// execution, which is a second, ungrounded source of facts arriving behind the
// retrieval this whole phase is built on. An assistant that can quietly look
// something up on the web is exactly the assistant this phase forbids.
//
// That leaves GPT-OSS and Qwen. GPT-OSS is chosen for one concrete reason
// beyond quality: it supports Groq's STRICT structured outputs (constrained
// decoding against a JSON schema), which the extractor below uses so a
// malformed filter object is unrepresentable rather than merely unlikely.
//
// The split is by job, not by size:
//
//   - EXTRACT is mechanical — turn a sentence into filters from a closed set.
//     20B with a strict schema does it, verified, and it is the faster model.
//   - ANSWER is where the guardrails live. Staying inside a supplied fact
//     block, declining off-topic questions and admitting ignorance are all
//     instruction-following, which is what 120B is for.
//
// Splitting also helps the accounting: Groq meters per model, so the cheap
// call cannot eat the answer budget.
//
// MEASURED LIMITS on this account, read from the response headers rather than
// from the docs (`x-ratelimit-limit-requests` / `-tokens`), 2026-08-27:
//
//   openai/gpt-oss-20b    1,000 requests/day |  8,000 tokens/minute
//   openai/gpt-oss-120b   1,000 requests/day |  8,000 tokens/minute
//
// TPM is the binding constraint, not RPD. A turn carrying a six-product fact
// block runs roughly 1,500-2,500 tokens, so sustained traffic hits
// tokens-per-minute long before requests-per-day — which is what makes
// graceful 429 handling a real requirement here and not a theoretical one.
export const GROQ_MODELS = {
  extract: "openai/gpt-oss-20b",
  answer: "openai/gpt-oss-120b",
} as const;

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

/**
 * A hung request is worse than a failed one: the browser holds a spinner and
 * the visitor has no idea whether to retry. 20s is generous for Groq, which is
 * fast enough that anything past a couple of seconds already means trouble.
 */
const REQUEST_TIMEOUT_MS = 20_000;

export type GroqRole = "system" | "user" | "assistant";
export type GroqMessage = { role: GroqRole; content: string };

/**
 * Why a union instead of an Error subclass: the route has to map each of these
 * to a different HTTP status and a different user-facing sentence, and doing
 * that off an `error instanceof X` chain is how one case ends up silently
 * falling through to a 500 — the one outcome this phase rules out.
 */
export type GroqFailure =
  /** No GROQ_API_KEY. A deployment mistake, but not one that may crash a page. */
  | { kind: "NOT_CONFIGURED" }
  /** HTTP 429. `retryAfterSeconds` comes from Groq's own header when present. */
  | { kind: "RATE_LIMITED"; retryAfterSeconds?: number }
  /** Timeout, network error, 5xx, or a response we could not read. */
  | { kind: "UNAVAILABLE"; detail: string };

export type GroqResult =
  | { ok: true; content: string }
  | { ok: false; failure: GroqFailure };

type GroqOptions = {
  model: string;
  messages: GroqMessage[];
  /** 0 for the extractor; the answer call stays low but not frozen. */
  temperature: number;
  /**
   * INCLUDES REASONING TOKENS. Both models think before they answer, and that
   * thinking is billed against this ceiling — a cap sized for the visible
   * reply alone comes back with `content: ""` once reasoning has eaten it,
   * which this client then reports as an empty completion. Measured with
   * `reasoning_effort: "low"`: ~25 reasoning tokens for a product answer.
   * Callers still leave real headroom.
   */
  maxTokens: number;
  /**
   * How much chain-of-thought to spend. "low" throughout: neither job here is
   * a reasoning problem — one is a parse, the other is writing three sentences
   * from a fact block in front of it — and reasoning tokens come out of both
   * the latency budget and the 8,000 TPM ceiling. Measured at "medium" the
   * same answer cost 75 reasoning tokens instead of 22 and said the same thing.
   */
  reasoningEffort?: "low" | "medium" | "high";
  /**
   * Strict structured output — constrained decoding against a JSON schema, so
   * the model cannot emit a shape that does not match. Supported on GPT-OSS
   * and Qwen only; on a model without it Groq rejects the request rather than
   * silently downgrading, which is the right failure.
   *
   * Callers still parse the result with Zod. Constrained decoding guarantees
   * the shape, not that the model put sensible values in it, and this schema
   * is reached over a network from a third party — trusting it because we
   * asked nicely would be the same mistake as trusting the reply text.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
};

/**
 * The key is read per call, not at module load.
 *
 * lib/r2.ts and lib/db.ts both throw at import time for missing config, and
 * that is right for them: without a database there is no site, and a catalogue
 * rendering without R2 is broken in a way worth failing loudly. The assistant
 * is different — it is one widget on an otherwise working storefront. A
 * missing key has to degrade that widget to "message us on WhatsApp", not take
 * the catalogue down with it, and a module-scope throw here would do the
 * latter because `next build` evaluates the module.
 */
function readKey() {
  return process.env.GROQ_API_KEY?.trim() || undefined;
}

function readBaseUrl() {
  const configured = process.env.GROQ_BASE_URL?.trim();
  return (configured || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * Groq sends `retry-after` in seconds. Parsed defensively — an unreadable
 * value means "we don't know", not "retry immediately".
 */
function parseRetryAfter(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;

  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

/** One attempt. The retry policy lives in the exported caller below. */
async function attempt(options: GroqOptions, key: string): Promise<GroqResult> {
  let response: Response;

  try {
    response = await fetch(`${readBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        // `max_tokens` is the deprecated spelling in the OpenAI-compatible
        // API; Groq's current parameter is `max_completion_tokens`.
        max_completion_tokens: options.maxTokens,
        ...(options.reasoningEffort
          ? { reasoning_effort: options.reasoningEffort }
          : {}),
        ...(options.jsonSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: options.jsonSchema.name,
                  strict: true,
                  schema: options.jsonSchema.schema,
                },
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // This is a per-visitor conversation. Nothing about it is cacheable, and
      // Next will cache a fetch inside a route handler if you let it.
      cache: "no-store",
    });
  } catch (error) {
    // AbortSignal.timeout rejects with a TimeoutError DOMException; a dropped
    // connection rejects with a TypeError. Both read as "unavailable" here.
    const detail =
      error instanceof Error ? `${error.name}: ${error.message}` : "fetch failed";
    return { ok: false, failure: { kind: "UNAVAILABLE", detail } };
  }

  if (response.status === 429) {
    return {
      ok: false,
      failure: {
        kind: "RATE_LIMITED",
        retryAfterSeconds: parseRetryAfter(response),
      },
    };
  }

  if (!response.ok) {
    // Read the body as text, not JSON: an HTML error page from a proxy sitting
    // in front of Groq must not itself become a parse failure.
    const body = await response.text().catch(() => "");
    return {
      ok: false,
      failure: {
        kind: "UNAVAILABLE",
        detail: `HTTP ${response.status} ${body.slice(0, 300)}`.trim(),
      },
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      failure: { kind: "UNAVAILABLE", detail: "response was not JSON" },
    };
  }

  // Reached through `unknown` rather than a cast: this is a third-party
  // response, and a shape assumption here would surface as a TypeError inside
  // a route handler — that is, as the raw 500 this phase rules out.
  const content = (payload as { choices?: { message?: { content?: unknown } }[] })
    ?.choices?.[0]?.message?.content;

  // An empty string is a real outcome on these models, not a wire error: the
  // reply lands in `message.content` while the thinking lands in
  // `message.reasoning`, so a maxTokens spent entirely on reasoning returns a
  // well-formed response saying nothing. Treated as unavailable — the visitor
  // gets the WhatsApp fallback rather than an empty chat bubble.
  if (typeof content !== "string" || content.trim() === "") {
    return {
      ok: false,
      failure: { kind: "UNAVAILABLE", detail: "empty completion" },
    };
  }

  return { ok: true, content };
}

/**
 * A chat completion, with one retry for transient failure.
 *
 * RATE_LIMITED is deliberately NOT retried. A 429 means the bucket is empty;
 * retrying inside the same request spends another unit of a 1,000/day budget
 * to be told the same thing, and adds latency to a reply somebody is already
 * waiting on. It goes straight back as "busy — try again, or use WhatsApp".
 */
export async function groqChat(options: GroqOptions): Promise<GroqResult> {
  const key = readKey();
  if (!key) return { ok: false, failure: { kind: "NOT_CONFIGURED" } };

  const first = await attempt(options, key);
  if (first.ok || first.failure.kind !== "UNAVAILABLE") return first;

  // 400ms: long enough to ride out a dropped connection, short enough that a
  // genuinely down upstream costs the visitor half a second, not five.
  await new Promise((resolve) => setTimeout(resolve, 400));
  return attempt(options, key);
}
