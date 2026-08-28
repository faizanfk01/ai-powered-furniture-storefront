"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { SITE } from "@/lib/site";

import { isBackdropClick } from "./backdrop-click";
import { ChatConversation } from "./chat-conversation";
import { useChat } from "./chat-context";

/**
 * The GLOBAL assistant: a right-hand slide-over, and nothing else.
 *
 * Mounted once in app/(storefront)/layout.tsx, so it is on every public page
 * and on none of the admin ones — and so its transcript survives client-side
 * navigation, because a layout does not remount when the page inside it
 * changes.
 *
 * NO LAUNCHER. This file used to render a floating ink button in the
 * bottom-right corner as well. It is gone: the header carries an Ask AI button
 * (components/site/ask-ai-button.tsx) and the mobile panel carries another,
 * and two permanent handles on one door is one too many — the floating one was
 * also the one that sat over the footer's last column and the catalogue's last
 * row of cards.
 *
 * Nothing about the drawer changed when it went. Open state lives in
 * ChatProvider, every trigger calls the same `setOpen`, and this component
 * only ever read that state — it never owned the launcher's behaviour, so
 * deleting the markup deleted the whole of it.
 *
 * This file is only the CONTAINER: the drawer shell and what it opens onto.
 * Everything that makes it a chat — the transcript, the composer, grounded
 * replies, the degradation notices — lives in ChatConversation, which the
 * product modal renders too. The two surfaces are meant to look and sit
 * differently; they are not meant to answer differently.
 */

const EXAMPLE_PROMPTS = [
  "What sofas do you have?",
  "Show me tables under Rs 30,000",
  "Where is your showroom?",
] as const;

export function ChatWidget() {
  // Open state lives in the provider so a future header entry can open the
  // drawer too. The transcript stays inside ChatConversation — nothing outside
  // needs it.
  const { open, setOpen } = useChat();

  const panelId = useId();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  // Close on navigation, keeping the transcript.
  //
  // Adjusted during render rather than in an effect — the same pattern as
  // components/site/mobile-nav.tsx, and for the same reason: an effect would
  // paint the stale open drawer first. On a phone the drawer covers the whole
  // screen, so leaving it open over the page somebody just tapped through to
  // would look like the tap failed.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (renderedPathname !== pathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  /**
   * React state into the dialog's imperative API.
   *
   * `.open` is checked before each call because showModal() on an already-open
   * dialog throws, and close() on a closed one fires a spurious `close` event.
   * Same pattern as components/admin/confirm-dialog.tsx.
   */
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    if (open && !drawer.open) drawer.showModal();
    if (!open && drawer.open) drawer.close();
  }, [open]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    // No manual refocus: closing a dialog restores focus to the element that
    // had it when showModal() was called — the header's Ask AI button, or the
    // one in the mobile panel. That is why removing the floating launcher cost
    // nothing here: the browser tracks the opener, this file never did.
    const handleClose = () => setOpen(false);

    drawer.addEventListener("close", handleClose);
    return () => drawer.removeEventListener("close", handleClose);
  }, [setOpen]);

  // THE DRAWER. A native <dialog>, slid in from the right edge — see the
  // .chat-drawer rules in app/globals.css. Always mounted rather than
  // conditionally rendered, so the transcript is never torn down and rebuilt,
  // and so there is something for the closing transition to animate.
  return (
    <dialog
      ref={drawerRef}
      id={panelId}
      aria-labelledby={`${panelId}-title`}
      onClick={(event) => {
        if (isBackdropClick(event)) setOpen(false);
      }}
      // Full width on a phone, a fixed column on anything larger. The
      // height, position and slide come from .chat-drawer.
      className="chat-drawer w-full shadow-2xl shadow-ink/20 sm:w-[26rem] sm:border-l sm:border-hairline"
    >
      {/* HEADER — the same ink as the site header directly above it, so the
          drawer reads as an extension of the site's chrome rather than a
          separate mode. Sentence case: the ruler ticks and the tracked-out
          capitals were the showroom identity's signage voice. */}
      <div className="flex items-center justify-between gap-4 bg-ink px-4 py-3.5 text-paper sm:px-5">
        <div className="min-w-0">
          <h2
            id={`${panelId}-title`}
            className="display-wide text-base leading-tight font-semibold"
          >
            Ask {SITE.name}
          </h2>
          <p className="mt-0.5 text-sm text-paper/60">
            Answers from our catalogue
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <span className="sr-only">Close</span>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <ChatConversation
        active={open}
        placeholder="Ask about a piece, a budget, or how to order"
        inputLabel="Ask a question about our furniture"
        emptyState={(ask) => <EntryState onPick={ask} />}
      />
    </dialog>
  );
}

/**
 * The global drawer's entry state.
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
      <p className="leading-relaxed text-muted">
        Ask about our furniture, find something in your budget, or ask how to
        order. Every answer comes from our own catalogue, so if we don&rsquo;t
        have something it will tell you.
      </p>

      <p className="mt-5 text-sm font-semibold text-ink">Try asking</p>

      <ul className="mt-2.5 space-y-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              className="w-full rounded-xl border border-hairline bg-paper px-3.5 py-2.5 text-left text-sm text-ink shadow-sm transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
