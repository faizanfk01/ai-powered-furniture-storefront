"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";

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

export function ChatWidget() {
  // Open state lives in the provider so a future header entry can open the
  // drawer too. The transcript stays inside ChatConversation — nothing outside
  // needs it.
  const { open, setOpen } = useChat();

  const panelId = useId();
  const drawerRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  /**
   * Close on navigation, keeping the transcript.
   *
   * IN AN EFFECT, AND IT HAS TO BE. This was written as a render-phase
   * adjustment — compare the previous pathname, and if it changed, set state
   * on the spot — copied from components/site/mobile-nav.tsx, which does
   * exactly that and is correct.
   *
   * The difference is WHOSE STATE IS BEING SET, and it is the whole bug.
   * Adjusting state during render is a documented React pattern, but only for
   * the component's OWN state: React can re-run the render it is already in
   * the middle of and nothing outside notices. `setOpen` is not ours. It comes
   * from ChatProvider through useChat(), so calling it here asked React to
   * schedule an update on a component further up the tree while this one was
   * still rendering — which is unresolvable, and which React reports as
   * "Cannot update a component (ChatProvider) while rendering a different
   * component (ChatWidget)". MobileNav's `setOpen` is its own useState, which
   * is why the same shape is fine there and not here.
   *
   * A ref rather than state for the comparison: this value is only ever read
   * to answer "did the path change since last time", and holding it in state
   * would mean a second update in the same effect for no visible benefit.
   *
   * Guarded so it fires on a real navigation only. Without the check, this
   * would also run on mount, and closing an already-closed drawer on every
   * mount is a no-op that invites someone to wonder whether it is.
   */
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    setOpen(false);
  }, [pathname, setOpen]);

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
      // Full width on a phone, a fixed column on anything larger, one step
      // wider again on a large monitor — 26rem beside a 1728px catalogue is a
      // slot, not a panel. The height, position and slide come from
      // .chat-drawer.
      className="chat-drawer w-full shadow-2xl shadow-ink/20 sm:w-[26rem] sm:border-l sm:border-hairline xl:w-[28rem] 3xl:w-[32rem]"
    >
      {/* HEADER — the same ink as the site header directly above it, so the
          drawer reads as an extension of the site's chrome rather than a
          separate mode. Sentence case: the ruler ticks and the tracked-out
          capitals were the showroom identity's signage voice. */}
      <div className="flex shrink-0 items-center justify-between gap-4 bg-ink px-4 py-3.5 text-paper sm:px-5">
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
        scope={{ kind: "site" }}
        placeholder="Ask here"
        inputLabel="Ask a question about our furniture"
        emptyState={() => <EntryState />}
      />
    </dialog>
  );
}

/**
 * The global drawer's entry state — the sentence, and nothing else.
 *
 * The three example questions that used to live here as a stacked button list
 * are now quick-reply chips, rendered by ChatConversation from
 * components/chat/suggestions.ts. They did not change and neither did what
 * they are for: they are the scope of the assistant, shown rather than
 * described, one from each thing it can actually do (a category, a budget, the
 * business itself), because an empty chat box asks the customer to guess and
 * most people guess wrong.
 *
 * Moving them was the point of the change. The product modal opened on a blank
 * box for exactly the same reason and had no examples at all, and a second
 * copy of a prompt list is a second list to keep safe. One source now feeds
 * both surfaces, and the same chips appear again under each reply.
 */
function EntryState() {
  return (
    <p className="leading-relaxed text-muted">
      Ask about our furniture, find something in your budget, or ask how to
      order. Every answer comes from our own catalogue, so if we don&rsquo;t
      have something it will tell you.
    </p>
  );
}
