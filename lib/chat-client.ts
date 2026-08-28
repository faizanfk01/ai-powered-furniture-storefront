import type { ChatSuccess } from "./ai/chat";
import type { ApiErrorBody } from "./api";
import type { ChatMessageInput } from "./validations/chat";

/**
 * Talking to POST /api/chat from the browser.
 *
 * Client-safe by construction: this module imports nothing at runtime. The
 * three imports above are all `import type` and are erased at compile time, so
 * pulling the request/response contract in here does not drag Prisma, Zod or
 * the Groq client into the browser bundle — while still meaning the widget and
 * the route are typed against the same definitions rather than against two
 * hand-copied interfaces that drift.
 *
 * That is also why the length caps live HERE and are imported BY
 * lib/validations/chat.ts rather than the other way round. The input needs a
 * maxLength and the server needs a limit, they must be the same number, and
 * the client must not pay for Zod to learn it.
 */

/**
 * Long enough for "do you have a six seater dining table under 90,000 that
 * would fit a narrow room?", short enough that a pasted essay is rejected
 * rather than forwarded to Groq.
 */
export const CHAT_MAX_MESSAGE_LENGTH = 600;

/**
 * Turns of prior conversation sent back up with each message. Ten keeps a real
 * follow-up thread ("what about cheaper ones?") working while bounding the
 * prompt.
 */
export const CHAT_MAX_HISTORY = 10;

/**
 * How long the customer waits before we stop waiting for them.
 *
 * The requirement is that the widget never hangs, and this is what enforces
 * it — a promise made on the client, where the spinner actually is, rather
 * than one inferred from the server's own timeouts.
 *
 * 25 seconds is far past a normal turn (Groq answers in one to three) and is
 * chosen to be shorter than the server's own worst case, not longer: see the
 * note at the bottom of this file.
 */
const CHAT_TIMEOUT_MS = 25_000;

export type ChatFailureKind =
  /** 429 — the free-tier ceiling. Worth offering a retry. */
  | "BUSY"
  /** 503, a network error, or our own timeout. Retry is offered but hopeful. */
  | "UNAVAILABLE"
  /** 400 — the message itself was rejected. Retrying it unchanged is pointless. */
  | "INVALID";

export type ChatTurnResult =
  | { ok: true; data: ChatSuccess }
  | {
      ok: false;
      kind: ChatFailureKind;
      /** Shown to the customer. Comes from the API when the API had words. */
      message: string;
      retryAfterSeconds?: number;
    };

/**
 * The API's own message is preferred over anything written here.
 *
 * app/api/chat/route.ts already composes sentences that name WhatsApp and the
 * real phone number. Overwriting them with a generic "something went wrong"
 * would throw away the more useful text — the same reasoning as
 * describeApiFailure() in lib/api-client.ts, which is for the admin surface
 * where a raw code is wanted.
 */
const FALLBACK_MESSAGE: Record<ChatFailureKind, string> = {
  BUSY: "The assistant is busy right now. Please try again in a moment, or message us on WhatsApp.",
  UNAVAILABLE:
    "The assistant is not working right now. Message us on WhatsApp and we will answer you ourselves.",
  INVALID: "That message could not be sent. Try wording it a bit differently.",
};

function failure(
  kind: ChatFailureKind,
  message?: string,
  retryAfterSeconds?: number,
): ChatTurnResult {
  return {
    ok: false,
    kind,
    message: message?.trim() || FALLBACK_MESSAGE[kind],
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

function parseRetryAfter(response: Response) {
  const raw = response.headers.get("retry-after");
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : undefined;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessageInput[],
): Promise<ChatTurnResult> {
  let response: Response;

  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, history: history.slice(-CHAT_MAX_HISTORY) }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch {
    // A dropped connection, an offline phone, or our own timeout. All three
    // are the same thing to somebody looking at a chat panel.
    return failure("UNAVAILABLE");
  }

  if (response.ok) {
    try {
      return { ok: true, data: (await response.json()) as ChatSuccess };
    } catch {
      // A 200 whose body will not parse is not a success. Without this the
      // widget would render `undefined` into the transcript.
      return failure("UNAVAILABLE");
    }
  }

  // Every non-2xx from this API carries { error: { code, message } }. Anything
  // that does not is from outside it — a proxy, the dev server — and then only
  // the status is known.
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    body = undefined;
  }

  const apiMessage = body?.error?.message;

  if (response.status === 429) {
    return failure("BUSY", apiMessage, parseRetryAfter(response));
  }
  if (response.status === 400) {
    return failure("INVALID", apiMessage);
  }

  return failure("UNAVAILABLE", apiMessage);
}

// ---------------------------------------------------------------------------
// KNOWN, AND NOT FIXED HERE — the server's worst case is longer than this one.
//
// lib/ai/groq.ts allows 20s per attempt plus one retry, and a turn makes two
// calls, so a hung (rather than failing) Groq could keep the route busy for
// roughly 80 seconds. The abort above means the CUSTOMER never sees more than
// 25 of that — they get the WhatsApp fallback and can carry on — but the
// request itself keeps running server-side and keeps spending quota.
//
// Left alone because it is Phase 3 Step 1 code that has already been reviewed,
// and shortening a timeout there is a decision about the API's contract rather
// than about this widget. Worth doing before launch.
// ---------------------------------------------------------------------------
