"use client";

import { useEffect, useId, useRef } from "react";

import { Measure } from "@/components/ui/measure";

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
      className="chat-modal w-[min(34rem,calc(100vw-2rem))] max-h-[min(40rem,calc(100dvh-2rem))] border border-ink/15 shadow-2xl shadow-ink/30"
    >
      <div className="flex items-start justify-between gap-4 bg-ink-deep px-5 py-4 text-paper">
        <div className="min-w-0">
          <Measure width="w-12" />
          <p className="spec-label mt-2.5 text-paper/55">Ask AI about</p>
          <h2
            id={`${modalId}-title`}
            className="display-wide mt-1 text-base leading-tight font-medium uppercase"
          >
            {productName}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="spec-label -mr-2 -mt-1 shrink-0 px-2 py-2 text-paper/70 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Close
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
