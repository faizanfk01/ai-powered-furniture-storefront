"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";

import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import type { ChatProduct } from "@/lib/ai/facts";
import {
  CHAT_MAX_HISTORY,
  CHAT_MAX_MESSAGE_LENGTH,
  sendChatMessage,
  type ChatFailureKind,
} from "@/lib/chat-client";
import { SITE, WHATSAPP_DISPLAY, whatsappUrl } from "@/lib/site";
import type { ChatMessageInput } from "@/lib/validations/chat";

import { ChatProductCard } from "./chat-product-card";
import { ChatReply } from "./chat-reply";
import { ChatThinking } from "./chat-thinking";

/**
 * A conversation with the assistant — transcript, composer, and everything
 * that happens between them. NOT a container: it has no dialog, no header and
 * no open state, and it fills whatever box it is given.
 *
 * Extracted so the two AI entry points can be genuinely different surfaces
 * while being the same chat. The global drawer and the product modal differ in
 * where they sit, what they are called, and what they open with; they must not
 * differ in how a reply is rendered, how a rate limit is reported, or how
 * history is assembled. Those are the parts where a second copy would drift
 * into a second set of bugs.
 *
 * Each instance owns its own transcript. That is what makes the product modal
 * "scoped to that product": opening it shows a conversation about the piece
 * you are looking at, not whatever was last said in the global drawer.
 */

/** The panel's transcript. `notice` is ours, not the model's. */
type Entry =
  | { kind: "user"; id: string; text: string }
  | {
      kind: "assistant";
      id: string;
      text: string;
      products: ChatProduct[];
      /** Refs the reply actually cited — the ones worth showing as cards. */
      citations: number[];
      whatsappUrl: string;
    }
  | {
      kind: "notice";
      id: string;
      failure: ChatFailureKind;
      text: string;
      /** The message that failed, so "Try again" has something to resend. */
      retryable: string | null;
    };

const GENERIC_WHATSAPP = whatsappUrl(`Hello ${SITE.name} — I have a question.`);

let entrySeq = 0;
const nextId = () => `entry-${++entrySeq}`;

/**
 * What a container can do to a conversation from the outside.
 *
 * A ref rather than a prop, because asking is an EVENT, not a value. The
 * product modal asks its opening question from inside the click handler that
 * opens it — which is where state updates belong. Passing a `seed` prop and
 * reacting to it with an effect was the first design, and it meant calling
 * setState synchronously inside an effect body: a cascading render, and one
 * this project's lint config rejects outright.
 */
export type ChatHandle = {
  /** Ask a question. Silently ignored if this exact question is already in the
   *  transcript, so reopening a container does not re-ask and re-spend. */
  ask: (message: string) => void;
};

export function ChatConversation({
  active,
  emptyState,
  placeholder,
  inputLabel,
  ref,
}: {
  /** True while the container is open. Drives autofocus and scrolling. */
  active: boolean;
  /** Rendered when nothing has been asked yet. Gets a callback to ask. */
  emptyState: (ask: (prompt: string) => void) => ReactNode;
  placeholder: string;
  inputLabel: string;
  ref?: Ref<ChatHandle>;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");

  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Focus the composer when the container opens, so a keyboard user can type
  // at once and a screen reader lands inside the dialog rather than behind it.
  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Keep the newest message in view. `auto` under reduced motion: a long
  // smooth scroll is exactly the kind of movement that setting asks us not to
  // make.
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;

    transcript.scrollTo({
      top: transcript.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [entries, pending]);

  /**
   * History sent back up with each turn.
   *
   * Notices are excluded — "the assistant is busy" is this widget's sentence,
   * not something the assistant said, and replaying it as an assistant turn
   * would teach the model that it talks that way. The server caps the length
   * too; slicing here keeps the request small rather than relying on being
   * trimmed at the far end.
   */
  function historyFor(current: Entry[]): ChatMessageInput[] {
    return current
      .filter(
        (entry): entry is Extract<Entry, { kind: "user" | "assistant" }> =>
          entry.kind === "user" || entry.kind === "assistant",
      )
      .map((entry) => ({
        role: entry.kind === "user" ? ("user" as const) : ("assistant" as const),
        content: entry.text,
      }))
      .slice(-CHAT_MAX_HISTORY);
  }

  /**
   * @param base the transcript this message is being asked ON TOP OF.
   *
   * Passed in rather than read from `entries` because the retry path first
   * removes the failed exchange, and `setEntries` does not update the value
   * this closure captured. Reading state here would have rebuilt the history
   * from the transcript as it was BEFORE that removal — sending the failed
   * question twice, once as history and once as the message.
   */
  async function send(message: string, base: Entry[]) {
    const trimmed = message.trim();
    if (!trimmed || pending) return;

    const question: Entry = { kind: "user", id: nextId(), text: trimmed };

    // History is what came before: the message being asked travels as
    // `message`, and including it here as well would show the model the same
    // sentence twice.
    const history = historyFor(base);

    setEntries([...base, question]);
    setDraft("");
    setPending(true);

    const result = await sendChatMessage(trimmed, history);

    setEntries((current) => [
      ...current,
      result.ok
        ? {
            kind: "assistant",
            id: nextId(),
            text: result.data.reply,
            products: result.data.products,
            citations: result.data.citations,
            whatsappUrl: result.data.whatsappUrl,
          }
        : {
            kind: "notice",
            id: nextId(),
            failure: result.kind,
            text: result.message,
            // A rejected message is not worth resending unchanged; a busy or
            // unavailable one is exactly what "Try again" is for.
            retryable: result.kind === "INVALID" ? null : trimmed,
          },
    ]);
    setPending(false);
  }

  /** Resend after a failure, dropping the failed exchange it is replacing. */
  function retry(noticeId: string, message: string) {
    const index = entries.findIndex((entry) => entry.id === noticeId);
    // The failed question sits directly before its notice, so both go. The
    // retry then reads as one exchange rather than stacking a second copy of a
    // question the customer only asked once.
    const base = entries.slice(0, Math.max(0, index - 1));

    setEntries(base);
    void send(message, base);
  }

  /**
   * Ask from outside — the product modal's opening question.
   *
   * The already-asked check is what makes reopening the modal cheap: the
   * question is composed by seedMessage() on both sides, so the comparison is
   * exact rather than a guess at what the text might have been, and a customer
   * who closes and reopens gets the conversation back instead of a duplicate
   * question and a second Groq request.
   */
  useImperativeHandle(
    ref,
    () => ({
      ask(message: string) {
        const trimmed = message.trim();
        const alreadyAsked = entries.some(
          (entry) => entry.kind === "user" && entry.text === trimmed,
        );
        if (!alreadyAsked) void send(trimmed, entries);
      },
    }),
    // Rebuilt whenever the transcript or the in-flight flag changes, so the
    // captured `entries` the handle closes over is never a stale one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, pending],
  );

  // The most recent turn's prefilled handoff, which carries the customer's own
  // question and the product the reply led with. Falls back to a plain opener
  // before anything has been asked.
  const latestHandoff =
    [...entries].reverse().find((entry) => entry.kind === "assistant")
      ?.whatsappUrl ?? GENERIC_WHATSAPP;

  const empty = entries.length === 0;
  const overLimit = draft.length > CHAT_MAX_MESSAGE_LENGTH;

  return (
    <>
      {/* TRANSCRIPT */}
      <div
        ref={transcriptRef}
        className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
      >
        {empty && emptyState((prompt) => void send(prompt, entries))}

        {/* Rendered unconditionally, even while empty. A live region that
            appears at the same moment its first content does is not reliably
            announced — several screen readers only watch regions that were
            already in the tree. Mounting it with the panel means the first
            reply is announced like every one after it. */}
        <div role="log" aria-live="polite" className="space-y-5">
          {entries.map((entry) => (
            <TranscriptEntry key={entry.id} entry={entry} onRetry={retry} />
          ))}
        </div>

        {pending && <ChatThinking />}
      </div>

      {/* COMPOSER + the WhatsApp line, which stays visible in every state
          because it is the only actual conversion path (CLAUDE.md → Payments).
          The assistant answers questions; it does not take orders, and neither
          container should ever look like it does. */}
      <div
        className="border-t border-hairline bg-hairline/25 px-5 pt-4 pb-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!overLimit) void send(draft, entries);
          }}
          className="flex items-stretch gap-2"
        >
          <label htmlFor={`${fieldId}-input`} className="sr-only">
            {inputLabel}
          </label>
          <input
            ref={inputRef}
            id={`${fieldId}-input`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            // Not `maxLength`: a hard cap silently swallows keystrokes and the
            // customer cannot tell why. The counter below appears instead, and
            // the button disables — the limit becomes something they can see
            // rather than something that happens.
            aria-invalid={overLimit || undefined}
            aria-describedby={overLimit ? `${fieldId}-limit` : undefined}
            className={`min-w-0 flex-1 border bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
              overLimit ? "border-brass" : "border-ink/20"
            }`}
          />
          <button
            type="submit"
            disabled={pending || draft.trim() === "" || overLimit}
            className="shrink-0 bg-ink px-4 font-display text-xs font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:bg-ink/25"
          >
            Send
          </button>
        </form>

        {overLimit && (
          <p id={`${fieldId}-limit`} className="spec-label mt-2 text-brass">
            {draft.length - CHAT_MAX_MESSAGE_LENGTH} characters over — please
            shorten
          </p>
        )}

        <a
          href={latestHandoff}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-2 text-xs text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <WhatsAppIcon className="size-4 shrink-0" />
          <span>
            To order or confirm a price, message us on{" "}
            <span className="font-mono">{WHATSAPP_DISPLAY}</span>
          </span>
        </a>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function TranscriptEntry({
  entry,
  onRetry,
}: {
  entry: Entry;
  onRetry: (noticeId: string, message: string) => void;
}) {
  if (entry.kind === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] bg-ink px-3.5 py-2.5 text-sm leading-relaxed text-paper">
          {entry.text}
        </p>
      </div>
    );
  }

  if (entry.kind === "assistant") {
    // Only the products the reply actually cited. The retrieval often returns
    // more than the answer discusses, and showing an uncited row as a card
    // would be the panel recommending something the assistant did not.
    const cited = entry.products.filter((product) =>
      entry.citations.includes(product.ref),
    );

    return (
      <div className="space-y-3">
        <ChatReply text={entry.text} products={entry.products} />

        {cited.length > 0 && (
          <ul className="space-y-2">
            {cited.map((product) => (
              <li key={product.id}>
                <ChatProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Captured before the JSX so the guard below actually narrows it: inside an
  // arrow function, TypeScript cannot know `entry.retryable` is still non-null.
  const { retryable } = entry;

  // NOTICE. Brass rule rather than red: this is not an error the customer
  // made, and dressing a rate limit as a fault makes a working site look
  // broken. It says what happened, offers the retry when retrying could help,
  // and puts WhatsApp directly in reach — which is the actual answer to "the
  // assistant cannot help you right now".
  return (
    <div className="border-l-2 border-brass bg-hairline/30 py-3 pr-3 pl-4">
      <p className="spec-label text-brass">
        {entry.failure === "BUSY" ? "Busy" : "Unavailable"}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{entry.text}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {retryable && (
          <button
            type="button"
            onClick={() => onRetry(entry.id, retryable)}
            className="spec-label border border-ink/25 px-3 py-1.5 text-ink transition-colors hover:border-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Try again
          </button>
        )}

        <a
          href={GENERIC_WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="spec-label inline-flex items-center gap-2 border border-ink/25 px-3 py-1.5 text-ink transition-colors hover:border-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <WhatsAppIcon className="size-3.5" />
          Message us
        </a>
      </div>
    </div>
  );
}
