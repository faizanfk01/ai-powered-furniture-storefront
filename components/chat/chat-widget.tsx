"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Measure } from "@/components/ui/measure";
import type { ChatProduct } from "@/lib/ai/facts";
import {
  CHAT_MAX_HISTORY,
  CHAT_MAX_MESSAGE_LENGTH,
  sendChatMessage,
  type ChatFailureKind,
} from "@/lib/chat-client";
import { SITE, WHATSAPP_DISPLAY, whatsappUrl } from "@/lib/site";
import type { ChatMessageInput } from "@/lib/validations/chat";

import { seedMessage, useChat } from "./chat-context";
import { ChatProductCard } from "./chat-product-card";
import { ChatReply } from "./chat-reply";
import { ChatThinking } from "./chat-thinking";

/**
 * The storefront assistant, as a panel.
 *
 * Mounted once in app/(storefront)/layout.tsx, so it is on every public page
 * and on none of the admin ones — and so its state survives client-side
 * navigation, because a layout does not remount when the page inside it
 * changes. Tapping a product the assistant recommended and then coming back
 * finds the conversation still there.
 *
 * The only client component in the site chrome besides the mobile nav.
 * Everything it needs from the server arrives through one fetch.
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

const EXAMPLE_PROMPTS = [
  "What sofas do you have?",
  "Show me tables under Rs 30,000",
  "Where is your showroom?",
] as const;

const GENERIC_WHATSAPP = whatsappUrl(
  `Hello ${SITE.name} — I have a question.`,
);

let entrySeq = 0;
const nextId = () => `entry-${++entrySeq}`;

export function ChatWidget() {
  // Open state lives in the provider, not here, because the product page's
  // "Ask AI about this piece" button needs to open this panel from a different
  // branch of the tree. The transcript stays local — nothing outside needs it.
  const { open, setOpen, registerAsk } = useChat();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");

  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on navigation, keeping the transcript.
  //
  // Adjusted during render rather than in an effect — the same pattern as
  // components/site/mobile-nav.tsx, and for the same reason: an effect would
  // paint the stale open panel first. On a phone the panel covers the whole
  // screen, so leaving it open over the product page somebody just tapped
  // through to would look like the tap failed. The messages stay in state, so
  // reopening resumes the conversation rather than starting a new one.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (renderedPathname !== pathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  /**
   * React state into the dialog's imperative API.
   *
   * `.open` is checked before each call because showModal() on an
   * already-open dialog throws, and close() on a closed one fires a spurious
   * `close` event. Same pattern as components/admin/confirm-dialog.tsx.
   *
   * What used to live here and no longer needs to: a keydown listener for
   * Escape, and a body-scroll lock. A modal dialog does both itself, and does
   * them better — the background is genuinely inert rather than merely
   * unscrollable.
   */
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    if (open && !drawer.open) drawer.showModal();
    if (!open && drawer.open) drawer.close();
  }, [open]);

  /**
   * The dialog closing for any reason — Escape, or our own close() — puts the
   * React state back in step and returns focus to the launcher that opened it.
   */
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    // No manual refocus: closing a dialog restores focus to the element that
    // had it when showModal() was called, which is the launcher. Doing it by
    // hand as well would race the browser for the same outcome.
    const handleClose = () => setOpen(false);

    drawer.addEventListener("close", handleClose);
    return () => drawer.removeEventListener("close", handleClose);
  }, [setOpen]);

  // Focus the input when the panel opens, so a keyboard user can type at once
  // and a screen reader lands inside the dialog rather than behind it.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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
   * "Ask AI about this piece", arriving from the product page.
   *
   * The seed is a sentence, not a special mode: it goes through send() and
   * POST /api/chat exactly like something typed into the box, which is what
   * keeps the grounding argument intact — the assistant answers by retrieving
   * the product for real, and there is no second path into the model.
   *
   * ALREADY-ASKED CHECK. Clicking the button again after closing the panel
   * should reopen the conversation, not append a second identical question and
   * spend another Groq request on an answer that is already on screen. Both
   * sides compose the sentence with seedMessage(), so the comparison is exact
   * rather than a guess at what the text might have been.
   *
   * Registered on every render so the closure always sees the current
   * transcript. The effect only writes to a ref — no state is set here, and
   * nothing re-renders because of it.
   */
  useEffect(() => {
    registerAsk((productName) => {
      const message = seedMessage(productName);
      const alreadyAsked = entries.some(
        (entry) => entry.kind === "user" && entry.text === message,
      );
      if (!alreadyAsked) void send(message, entries);
    });
  });

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
      {/* LAUNCHER. Square, ink, display face — the same geometry as Button.
          Sits above the footer's content on z-40 like the header, and clear of
          the iOS home indicator via safe-area insets. */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        // The display utility is set ONLY in the conditional below, never in
        // the base. `inline-flex ... hidden` in one class string is a coin
        // toss: both are unprefixed display utilities, so which one wins comes
        // from Tailwind's own ordering of the generated CSS rather than from
        // the order they are written here.
        //
        // Hidden while the drawer is open, at every size. The drawer is modal
        // now, so the launcher behind it is inert anyway — leaving it showing
        // through the scrim would be a button that looks pressable and is not.
        className={`fixed right-4 bottom-4 z-40 items-center gap-2.5 bg-ink px-5 py-3.5 font-display text-sm font-medium tracking-wide text-paper uppercase shadow-lg shadow-ink/20 transition-colors hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:right-6 sm:bottom-6 ${
          open ? "hidden" : "inline-flex"
        }`}
        style={{
          marginBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <ChatGlyph />
        Ask AI
      </button>

      {/* THE DRAWER. A native <dialog>, slid in from the right edge — see the
          .chat-drawer rules in app/globals.css for the transition and the
          reasoning. Always mounted rather than conditionally rendered, so the
          transcript is never torn down and rebuilt, and so there is something
          for the closing transition to animate. */}
      <dialog
        ref={drawerRef}
        id={panelId}
        aria-labelledby={`${panelId}-title`}
        // Clicking the scrim closes. A dialog's backdrop is not a child
        // element, so a click on it lands on the <dialog> itself — this is the
        // standard way to tell the two apart, by asking whether the click
        // landed outside the drawer's own box.
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const box = event.currentTarget.getBoundingClientRect();
          const outside =
            event.clientX < box.left ||
            event.clientX > box.right ||
            event.clientY < box.top ||
            event.clientY > box.bottom;
          if (outside) setOpen(false);
        }}
        // Full width on a phone, a fixed column on anything larger. The
        // height, position and slide come from .chat-drawer.
        className="chat-drawer w-full shadow-2xl shadow-ink/30 sm:w-[26rem] sm:border-l sm:border-ink/15"
      >
        {/* HEADER — an ink band, so the panel reads as a different mode of
            the site rather than a card floating on the page. */}
        <div className="flex items-start justify-between gap-4 bg-ink-deep px-5 py-4 text-paper">
          <div>
            <Measure width="w-12" />
            <h2
              id={`${panelId}-title`}
              className="display-wide mt-2.5 text-base leading-tight font-medium uppercase"
            >
              Ask {SITE.name}
            </h2>
            <p className="spec-label mt-1 text-paper/55">
              Answers from our catalogue
            </p>
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="spec-label -mr-2 -mt-1 shrink-0 px-2 py-2 text-paper/70 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Close
          </button>
        </div>

        {/* TRANSCRIPT */}
        <div
          ref={transcriptRef}
          className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
        >
          {empty && <EntryState onPick={(prompt) => void send(prompt, entries)} />}

          {/* Rendered unconditionally, even while empty. A live region that
              appears at the same moment its first content does is not
              reliably announced — several screen readers only watch regions
              that were already in the tree. Mounting it with the panel means
              the first reply is announced like every one after it. */}
          <div role="log" aria-live="polite" className="space-y-5">
            {entries.map((entry) => (
              <TranscriptEntry key={entry.id} entry={entry} onRetry={retry} />
            ))}
          </div>

          {pending && <ChatThinking />}
        </div>

        {/* COMPOSER + the WhatsApp line, which stays visible in every state
            because it is the only actual conversion path (CLAUDE.md →
            Payments). The assistant answers questions; it does not take
            orders, and the panel should never look like it does. */}
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
            <label htmlFor={`${panelId}-input`} className="sr-only">
              Ask a question about our furniture
            </label>
            <input
              ref={inputRef}
              id={`${panelId}-input`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about a piece, a budget, or how to order"
              autoComplete="off"
              // Not `maxLength`: a hard cap silently swallows keystrokes and
              // the customer cannot tell why. The counter below appears
              // instead, and the button disables — the limit becomes
              // something they can see rather than something that happens.
              aria-invalid={overLimit || undefined}
              aria-describedby={overLimit ? `${panelId}-limit` : undefined}
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
            <p id={`${panelId}-limit`} className="spec-label mt-2 text-brass">
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
      </dialog>
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * The entry state.
 *
 * An empty chat box asks the customer to guess what it can do, and most people
 * guess wrong — either something it cannot answer, or nothing at all. So the
 * three examples are not decoration: they are the scope of the assistant,
 * shown rather than described, one from each thing it can actually do (a
 * category, a budget, the business itself).
 *
 * They are buttons, so tapping one asks it. A phone keyboard is the largest
 * obstacle between a customer and their first question.
 */
function EntryState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div>
      <p className="leading-relaxed text-ink">
        Ask about our furniture, find something in your budget, or ask how to
        order. Every answer comes from our own catalogue — if we don&rsquo;t
        have something, it will say so.
      </p>

      <p className="spec-label mt-6 text-muted">Try asking</p>

      <ul className="mt-3 space-y-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              className="w-full border border-hairline bg-hairline/30 px-3 py-2.5 text-left text-sm text-ink transition-colors hover:border-ink/25 hover:bg-hairline/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
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
  // broken. It says what happened, offers the retry when retrying could
  // help, and puts WhatsApp directly in reach — which is the actual answer
  // to "the assistant cannot help you right now".
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

/**
 * The launcher's glyph. Square-cornered, hairline weight — a speech mark drawn
 * in the same geometry as the measure and the footprint plans, rather than the
 * rounded bubble every chat widget on the internet uses.
 */
function ChatGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 1.5h13v9.5h-8L3 14.5V11H1.5z" />
      <path d="M4.5 5h7M4.5 7.75h4.5" stroke="#b98d4e" />
    </svg>
  );
}
