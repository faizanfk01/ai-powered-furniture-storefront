import { NextResponse } from "next/server";

import { apiError, handleApiError, readJson, validationFailed } from "@/lib/api";
import { runChat } from "@/lib/ai/chat";
import type { GroqFailure } from "@/lib/ai/groq";
import { WHATSAPP_DISPLAY } from "@/lib/site";
import { chatRequestSchema } from "@/lib/validations";

/**
 * POST /api/chat — the storefront assistant.
 *
 * PUBLIC and unauthenticated, like the rest of the storefront API. Unlike the
 * rest of it, every call spends a metered upstream quota, which is why
 * chatRequestSchema caps the message length and the history depth: those two
 * numbers are the only thing between this endpoint and somebody emptying the
 * day's Groq budget with a loop. See the note on rate limiting at the bottom.
 *
 * POST rather than GET even though nothing is written. The body carries the
 * conversation, which does not belong in a URL — it would land in access logs
 * and in the Referer header of anything the reply links to.
 *
 * Thin on purpose. The turn itself is lib/ai/chat.ts; this file maps its
 * outcomes onto status codes.
 */

// Nothing here is cacheable and nothing is prerenderable: every response
// depends on a request body and on live catalogue rows. Declared rather than
// inferred so that enabling Cache Components later cannot quietly turn a
// customer's conversation into a shared static response.
export const dynamic = "force-dynamic";

/**
 * The graceful signal this phase requires, instead of a 500 or a hang.
 *
 * NOT_CONFIGURED is grouped with UNAVAILABLE deliberately. To a visitor they
 * are the same event — the assistant cannot answer — and the difference (we
 * forgot to set an environment variable) is ours to see in the logs, not
 * theirs to read in a chat bubble.
 */
function respondToFailure(failure: GroqFailure) {
  if (failure.kind === "RATE_LIMITED") {
    const response = apiError(
      429,
      "AI_BUSY",
      `The assistant is busy right now. Please try again in a moment, or message us on WhatsApp at ${WHATSAPP_DISPLAY}.`,
    );
    // Passed straight through from Groq when it told us. A UI that backs off
    // by this beats one that retries on a timer of its own invention.
    if (failure.retryAfterSeconds !== undefined) {
      response.headers.set("retry-after", String(failure.retryAfterSeconds));
    }
    return response;
  }

  if (failure.kind === "NOT_CONFIGURED") {
    console.error("[chat] GROQ_API_KEY is not set — the assistant is disabled");
  } else {
    console.error("[chat] groq unavailable:", failure.detail);
  }

  return apiError(
    503,
    "AI_UNAVAILABLE",
    `The assistant is unavailable at the moment. Please message us on WhatsApp at ${WHATSAPP_DISPLAY} and we will answer you directly.`,
  );
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return body.response;

  const parsed = chatRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationFailed(parsed.error);

  try {
    const result = await runChat(parsed.data);

    if (!result.ok) return respondToFailure(result.failure);

    return NextResponse.json(result);
  } catch (error) {
    // Only reachable if the *database* fails — every Groq failure is already a
    // typed result above. handleApiError logs it and returns the standard
    // INTERNAL_ERROR body, so even this path is a shaped 500 rather than a
    // stack trace, and never a hang.
    return handleApiError(error);
  }
}

// ---------------------------------------------------------------------------
// NOT DONE HERE, ON PURPOSE — per-IP throttling.
//
// The caps in chatRequestSchema bound the cost of one request; they do nothing
// about ten thousand of them. Before this goes public it wants a per-IP limit
// in front of it. It is not built now because the only correct place for it is
// the edge (proxy.ts or the host's own rate limiting): an in-memory counter in
// a route handler resets on every deploy and is per-instance, which reads like
// protection without being any.
// ---------------------------------------------------------------------------
