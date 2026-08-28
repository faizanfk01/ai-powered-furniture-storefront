"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";

import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { storefrontControlClass } from "@/components/ui/field";
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
import { SuggestionChips } from "./suggestion-chips";
import {
  followUpSuggestions,
  starterSuggestions,
  type ChatScope,
} from "./suggestions";

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
      /**
       * PRODUCTS | BUSINESS | OFF_TOPIC, copied from the API's own retrieval
       * metadata. Only the quick-reply chips read it: a question about the
       * shop and a product search that found nothing both come back with no
       * rows, and they want different things offered next.
       */
      topic: string;
    }
  | {
      kind: "notice";
      id: string;
      failure: ChatFailureKind;
      text: string;
      /** The message that failed, so "Try again" has something to resend. */
      retryable: string | null;
    };

const GENERIC_WHATSAPP = whatsappUrl(`Hello ${SITE.name}, I have a question.`);

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
  scope,
  emptyState,
  placeholder,
  inputLabel,
  ref,
}: {
  /** True while the container is open. Drives autofocus and scrolling. */
  active: boolean;
  /**
   * What this conversation is about — the whole site, or one product.
   *
   * Only the quick-reply chips use it, and it lives here rather than in the
   * containers so both surfaces cannot drift into offering different chips
   * for the same situation. Same reasoning as everything else in this file:
   * the drawer and the modal are meant to look different and behave
   * identically.
   */
  scope: ChatScope;
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
            topic: result.data.retrieval.topic,
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

  /**
   * QUICK REPLIES. A chip is a pre-written message and nothing else: `onPick`
   * below is the same `send` the composer's form calls, so a tap and a typed
   * message are indistinguishable by the time either reaches POST /api/chat,
   * and both are retrieved and grounded identically. See suggestions.ts.
   *
   * Offered under the NEWEST reply only. Chips under every historical turn
   * would stack a column of stale questions down the transcript, and the one
   * that matters is the one next to the answer just given.
   *
   * Not offered while a reply is in flight — ChatThinking already occupies
   * that moment, and send() would ignore the tap anyway — and never under a
   * degradation notice, which carries its own "Try again" and "Message us"
   * pair and should not be crowded with questions the assistant just failed
   * to answer.
   */
  const newest = entries[entries.length - 1];
  const followUps =
    !pending && newest?.kind === "assistant"
      ? followUpSuggestions(
          scope,
          {
            products: newest.products,
            citations: newest.citations,
            topic: newest.topic,
          },
          entries.filter((entry) => entry.kind === "user").map((entry) => entry.text),
        )
      : [];

  return (
    <>
      {/* TRANSCRIPT */}
      <div
        ref={transcriptRef}
        // THE ONLY SCROLL AREA ON EITHER SURFACE.
        //
        // `min-h-0` is belt and braces rather than a fix: a flex item's
        // automatic minimum size is already 0 once it has a non-visible
        // overflow, so this element could always shrink. It is written down
        // because the day someone changes `overflow-y-auto` here for anything
        // else, `min-height: auto` comes back, the transcript stops shrinking,
        // and the panel starts overflowing again — which is a long way to
        // travel from an innocent-looking edit.
        //
        // `overscroll-contain` stops a swipe that reaches the end of the
        // transcript from chaining to the document behind it. The CSS in
        // app/globals.css locks that document while a chat dialog is open, so
        // this is the second of two independent guards against the same
        // scroll leak — which is the right number for the one gesture every
        // customer on a phone will make.
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
      >
        {empty && (
          <div className="space-y-5">
            {emptyState((prompt) => void send(prompt, entries))}

            {/* The starters. Both containers get them from the same place, so
                a blank panel is never a blank box in either one. */}
            <SuggestionChips
              label="Try asking"
              suggestions={starterSuggestions(scope)}
              onPick={(prompt) => void send(prompt, entries)}
            />
          </div>
        )}

        {/* Rendered unconditionally, even while empty. A live region that
            appears at the same moment its first content does is not reliably
            announced — several screen readers only watch regions that were
            already in the tree. Mounting it with the panel means the first
            reply is announced like every one after it. */}
        <div role="log" aria-live="polite" className="space-y-4">
          {entries.map((entry) => (
            <TranscriptEntry key={entry.id} entry={entry} onRetry={retry} />
          ))}
        </div>

        {pending && <ChatThinking />}

        {/* Outside the log region above on purpose: these are controls, not
            transcript, and a live region that re-announces three buttons every
            time a reply lands is noise on top of the reply itself. The label
            is screen-reader only — after an answer the chips read as what they
            are without being introduced. */}
        {followUps.length > 0 && (
          <SuggestionChips
            label="Suggested questions"
            labelHidden
            suggestions={followUps}
            onPick={(prompt) => void send(prompt, entries)}
          />
        )}
      </div>

      {/* COMPOSER + the WhatsApp line, which stays visible in every state
          because it is the only actual conversion path (CLAUDE.md → Payments).
          The assistant answers questions; it does not take orders, and neither
          container should ever look like it does. */}
      <div
        // `shrink-0` so the composer and the WhatsApp line under it keep their
        // full height at every viewport. They are the fixed bottom band of the
        // panel: the transcript above absorbs whatever height is left over,
        // and it is the only band that is allowed to.
        className="shrink-0 border-t border-hairline bg-surface px-4 pt-3 pb-3 sm:px-5"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
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
            className={`${composerControl(overLimit)} min-w-0 flex-1 text-sm`}
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending || draft.trim() === "" || overLimit}
            className="shrink-0"
          >
            Send
          </Button>
        </form>

        {overLimit && (
          <p id={`${fieldId}-limit`} className="mt-2 text-xs text-accent-strong">
            {draft.length - CHAT_MAX_MESSAGE_LENGTH} characters too many.
            Please shorten it.
          </p>
        )}

        <a
          href={latestHandoff}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex items-center gap-2 rounded-lg px-1 py-1 text-xs text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <WhatsAppIcon className="size-4 shrink-0" />
          <span>
            To order, or to check a price, message us on{" "}
            <span className="tabular">{WHATSAPP_DISPLAY}</span>
          </span>
        </a>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * The composer input, with the border swapped once the draft is over length.
 *
 * IT REPLACES THE BORDER UTILITY, IT DOES NOT APPEND ONE. Two border-color
 * classes on one element are resolved by CSS source order, not by the order
 * they were written into the string, so appending would leave the field
 * looking untouched while the counter underneath said it was too long. Same
 * trap, same fix as components/reviews/review-form.tsx.
 */
function composerControl(overLimit: boolean) {
  if (!overLimit) return storefrontControlClass;

  return storefrontControlClass
    .replace("border-line-strong", "border-accent-strong")
    .replace("hover:border-muted/50", "hover:border-accent-strong")
    .replace("focus:border-ink", "focus:border-accent-strong");
}

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
        {/* The customer's own words, in the brand dark. `rounded-br-md` docks
            the corner nearest the composer, which is the convention every
            messaging app has settled on for "this one is yours". */}
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3.5 py-2.5 text-sm leading-relaxed text-paper">
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
      <div className="space-y-2.5">
        {/* The mirror of the customer's bubble: light ground, docked on the
            left. The cited cards sit outside it rather than inside, so they
            read as things attached to the answer rather than part of the
            sentence. */}
        <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-3.5 py-3">
          <ChatReply text={entry.text} products={entry.products} />
        </div>

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

  // NOTICE. The accent, not red: this is not an error the customer made, and
  // dressing a rate limit as a fault makes a working site look broken. It says
  // what happened, offers the retry when retrying could help, and puts
  // WhatsApp directly in reach — which is the actual answer to "the assistant
  // cannot help you right now".
  //
  // Restyled into the tinted panel the storefront uses for a calm aside — the
  // same one carrying the AI summary and the provisional-hours caution. It was
  // a left rule in brass, which is a margin mark, and a margin mark on a chat
  // turn reads as an error gutter.
  return (
    <div className="rounded-xl border border-brass/30 bg-accent-soft p-3.5">
      <p className="text-sm font-semibold text-accent-strong">
        {entry.failure === "BUSY" ? "Busy" : "Unavailable"}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{entry.text}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {retryable && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRetry(entry.id, retryable)}
          >
            Try again
          </Button>
        )}

        <Button size="sm" variant="outline" href={GENERIC_WHATSAPP}>
          <WhatsAppIcon className="size-3.5" />
          Message us
        </Button>
      </div>
    </div>
  );
}
