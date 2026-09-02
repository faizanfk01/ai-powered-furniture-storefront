"use client";

import { useEffect, useId, useRef } from "react";

import { isBackdropClick } from "./backdrop-click";
import { ChatConversation, type ChatHandle } from "./chat-conversation";

/**
 * The PRODUCT assistant, opened from a product page: a full-screen sheet on a
 * phone, a centred modal from `sm` up.
 *
 * The second of two deliberately different containers. The global drawer slides
 * in from the edge and belongs to the whole site; this sits in the middle of
 * the screen and belongs to one piece of furniture — the shape says which one
 * you are in before you read a word of it.
 *
 * What is NOT different: the chat. The transcript, the grounded replies, the
 * cited product cards and the rate-limit notices all come from
 * ChatConversation, the same component the drawer renders. A second copy would
 * be a second set of bugs.
 *
 * Its own transcript, though, which is what "scoped to this product" means in
 * practice: opening it shows a conversation about the piece you are looking
 * at, not whatever was last said in the global drawer. The two can be open at
 * different times with different histories and neither disturbs the other.
 */
export function ProductChatModal({
  productName,
  open,
  onClose,
  /** Set by the parent so the opening question can be asked from its click. */
  chatRef,
}: {
  productName: string;
  open: boolean;
  onClose: () => void;
  chatRef: React.RefObject<ChatHandle | null>;
}) {
  const modalId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Closing a dialog restores focus to whatever had it when showModal() was
    // called — the button on the product page. Nothing to do by hand.
    const handleClose = () => onClose();

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      id={modalId}
      aria-labelledby={`${modalId}-title`}
      onClick={(event) => {
        if (isBackdropClick(event)) onClose();
      }}
      // A FULL-SCREEN SHEET ON A PHONE, a centred card from `sm` up.
      // Positioning and the entry transition are in the .chat-modal rules in
      // app/globals.css.
      //
      // It used to be the centred card at every width, with a max-height and
      // no height. A <dialog> is `height: fit-content`, so the box was only
      // ever as tall as the conversation inside it: on a phone that is a
      // small floating card in the middle of the screen, and the moment the
      // transcript grew past the cap the header, the messages and the
      // composer were all fighting over a few hundred pixels. The desktop
      // version of that box is right — there is room around it. On a 320px
      // screen there is no room around anything, and a chat that cannot show
      // its own composer is not a chat.
      //
      // `h-dvh`, not `h-screen`: dvh follows the browser's collapsing toolbar,
      // so the sheet ends at the real bottom edge rather than underneath it.
      // The composer already pads itself by env(safe-area-inset-bottom), so
      // going edge to edge does not put the input under the home indicator.
      //
      // `max-h-none` and `max-w-none` are not tidying. The UA stylesheet caps
      // a <dialog> at `calc(100% - 6px - 2em)` in BOTH axes, so without them
      // the sheet stops ~38px short of the screen it is supposed to fill and
      // floats inside its own backdrop — which is most of what "tiny and
      // cut-off" looked like.
      //
      // `w-full` RATHER THAN `w-screen`. This dialog is position: fixed, so
      // its percentage resolves against the initial containing block — the
      // viewport WITHOUT the scrollbar. `100vw` includes the scrollbar, and
      // app/globals.css reserves one permanently via `scrollbar-gutter:
      // stable`, so `w-screen` would be up to 15px wider than the space
      // actually available. Same reasoning holds the `sm:` inset at exactly
      // 1rem a side.
      className="chat-modal h-dvh max-h-none w-full max-w-none rounded-none border-0 shadow-2xl shadow-ink/20 sm:h-auto sm:max-h-[min(40rem,calc(100dvh-2rem))] sm:w-[34rem] sm:max-w-[calc(100%-2rem)] sm:rounded-2xl sm:border sm:border-hairline"
    >
      {/* The same ink header the drawer wears, so the two surfaces are
          recognisably one assistant in two places. What differs is the title:
          this one names the piece, and the shape of the container says the
          rest. */}
      <div className="flex shrink-0 items-center justify-between gap-4 bg-ink px-4 py-3.5 text-paper sm:px-5">
        <div className="min-w-0">
          <p className="text-sm text-paper/60">Ask AI about</p>
          <h2
            id={`${modalId}-title`}
            className="display-wide mt-0.5 truncate text-base leading-tight font-semibold"
          >
            {productName}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
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
        ref={chatRef}
        active={open}
        // Scoped to this piece, so the quick-reply chips are about it —
        // materials, a different size, whether it is in stock. Same chip
        // machinery as the drawer, different set. See components/chat/
        // suggestions.ts.
        scope={{ kind: "product", productName }}
        placeholder={`Ask about the ${productName}`}
        inputLabel={`Ask a question about the ${productName}`}
        // Only reached if the opening question somehow never ran — the modal
        // normally arrives with a question already in flight. Written as a
        // real state rather than a blank box, because a chat that opens empty
        // and silent looks broken.
        emptyState={() => (
          <p className="leading-relaxed text-muted">
            Ask about materials, sizes, or whether we can make this piece to a
            different size. Answers come from this product&rsquo;s own details.
          </p>
        )}
      />
    </dialog>
  );
}
