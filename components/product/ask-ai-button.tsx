"use client";

import { useRef, useState } from "react";

import type { ChatHandle } from "@/components/chat/chat-conversation";
import { ChatGlyph } from "@/components/chat/chat-glyph";
import { ProductChatModal } from "@/components/chat/product-chat-modal";
import { seedMessage } from "@/components/chat/seed";

/**
 * "Ask AI about this piece" — opens a centred modal scoped to this product.
 *
 * Deliberately NOT the global drawer. There are two AI entry points on this
 * site and they answer different questions: the drawer is "what do you sell?",
 * this is "tell me about the thing I am looking at". Giving them the same
 * container would make them feel like one feature that sometimes remembers
 * what page you are on — and would mean opening the product assistant showed
 * you whatever you had last asked the global one.
 *
 * SECONDARY, AND IT STAYS SECONDARY. The outline treatment is unchanged and
 * the solid "Enquire on WhatsApp" above it is still the only filled button on
 * the page. Nothing here should suggest the assistant is how you buy: it
 * answers questions about the piece, and every path to an actual order still
 * goes through a person on WhatsApp (CLAUDE.md → Payments).
 *
 * THE OPENING QUESTION IS ASKED FROM THE CLICK, not from an effect watching a
 * prop. The modal is always mounted (a closed dialog is display:none), so its
 * ChatConversation handle exists before the first click and `ask()` can run in
 * the same event that opens the dialog. State updates belong in event
 * handlers; the effect-watching-a-seed version of this called setState inside
 * an effect body, which is a cascading render.
 *
 * `ask()` ignores a question already in the transcript, so closing and
 * reopening resumes the conversation instead of re-asking and spending another
 * Groq request on an answer that is already on screen.
 */
export function AskAiButton({ productName }: { productName: string }) {
  const [open, setOpen] = useState(false);
  const chatRef = useRef<ChatHandle>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          chatRef.current?.ask(seedMessage(productName));
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex w-full items-center justify-center gap-2.5 border border-ink/25 px-6 py-3 font-display text-sm font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
      >
        <ChatGlyph />
        Ask AI about this piece
      </button>

      <p className="mt-2 text-sm text-muted">
        Answers about size, materials and options, from this page&rsquo;s own
        details. For a price, availability or an order, the workshop answers on
        WhatsApp.
      </p>

      <ProductChatModal
        productName={productName}
        open={open}
        onClose={() => setOpen(false)}
        chatRef={chatRef}
      />
    </div>
  );
}
