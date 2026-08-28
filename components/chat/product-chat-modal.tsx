"use client";

import { useEffect, useId, useRef } from "react";

import { isBackdropClick } from "./backdrop-click";
import { ChatConversation, type ChatHandle } from "./chat-conversation";

/**
 * The PRODUCT assistant: a centred modal, opened from a product page.
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
      // Nearly full height on a phone so the transcript has room; a centred
      // card from `sm` up. Positioning and the entry transition are in the
      // .chat-modal rules in app/globals.css.
      className="chat-modal w-[min(34rem,calc(100vw-2rem))] max-h-[min(40rem,calc(100dvh-2rem))] rounded-2xl border border-hairline shadow-2xl shadow-ink/20"
    >
      {/* The same ink header the drawer wears, so the two surfaces are
          recognisably one assistant in two places. What differs is the title:
          this one names the piece, and the shape of the container says the
          rest. */}
      <div className="flex items-center justify-between gap-4 bg-ink px-4 py-3.5 text-paper sm:px-5">
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
        placeholder={`Ask about the ${productName}`}
        inputLabel={`Ask a question about the ${productName}`}
        // Only reached if the opening question somehow never ran — the modal
        // normally arrives with a question already in flight. Written as a
        // real state rather than a blank box, because a chat that opens empty
        // and silent looks broken.
        emptyState={() => (
          <p className="leading-relaxed text-muted">
            Ask about materials, dimensions, or whether this piece can be made
            to a different size. Answers come from this product&rsquo;s own
            details.
          </p>
        )}
      />
    </dialog>
  );
}
