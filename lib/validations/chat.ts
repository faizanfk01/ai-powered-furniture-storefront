import { z } from "zod";

import { CHAT_MAX_HISTORY, CHAT_MAX_MESSAGE_LENGTH } from "../chat-client";

/**
 * The write boundary for POST /api/chat.
 *
 * "Write boundary" in the CLAUDE.md sense even though nothing is persisted:
 * this body is what decides how many tokens of an 8,000-per-minute budget the
 * request spends. An unbounded `message` or a 400-turn `history` is not a
 * correctness bug, it is somebody emptying the day's Groq quota with one
 * curl. The caps below are the only thing standing between a public,
 * unauthenticated endpoint and that.
 */

/**
 * The caps come from lib/chat-client.ts, which the browser also imports.
 *
 * That direction is deliberate. The chat input needs a maxLength, the route
 * needs a limit, and the two have to be the same number — but lib/chat-client
 * is loaded by a Client Component, so the shared constant cannot live in a
 * module that imports Zod. Putting it there and importing it here keeps one
 * definition without shipping a validation library to a phone.
 */
export { CHAT_MAX_HISTORY, CHAT_MAX_MESSAGE_LENGTH } from "../chat-client";

/**
 * A prior turn. `assistant` is allowed a longer body than a user message
 * because our own replies are longer than the questions that prompt them.
 *
 * UNTRUSTED, AND TREATED AS SUCH. History arrives from the browser, so a
 * crafted request can claim the assistant previously said anything at all —
 * including a product and a price that do not exist. Two structural defences,
 * neither of which is the prompt:
 *
 *   - Retrieval filters are derived server-side and applied as SQL bind
 *     parameters against the live catalogue, so no amount of invented history
 *     conjures a product row.
 *   - The grounding check in lib/ai/grounding.ts builds its allow-list from
 *     server-side facts and the *current* message only. Numbers planted in a
 *     forged history are never whitelisted by being there.
 */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Message content must not be empty")
    .max(2000, "Message content must be 2000 characters or fewer"),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Please type a question")
    .max(
      CHAT_MAX_MESSAGE_LENGTH,
      `Please keep it to ${CHAT_MAX_MESSAGE_LENGTH} characters or fewer`,
    ),

  history: z
    .array(chatMessageSchema)
    .max(CHAT_MAX_HISTORY, `History must be ${CHAT_MAX_HISTORY} messages or fewer`)
    .default([]),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
