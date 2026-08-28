"use client";

import { useRef, useState } from "react";

import type { ChatHandle } from "@/components/chat/chat-conversation";
import { ChatGlyph } from "@/components/chat/chat-glyph";
import { ProductChatModal } from "@/components/chat/product-chat-modal";
import { seedMessage } from "@/components/chat/seed";
import { Button } from "@/components/ui/button";

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
 * SECONDARY, AND IT STAYS SECONDARY. It renders the Button primitive's
 * `outline` variant, and the solid "Enquire on WhatsApp" above it is still the
 * only filled button on the page. Nothing here should suggest the assistant is how you buy: it
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
      {/* The `outline` variant, and the WhatsApp button above it is `solid`.
          That pairing is the whole of "secondary" here — same size, same
          radius, one filled and one not. */}
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => {
          setOpen(true);
          chatRef.current?.ask(seedMessage(productName));
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full sm:w-auto"
      >
        <ChatGlyph />
        Ask AI about this piece
      </Button>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        It answers questions about size, materials and options, using the
        details on this page. For a price, what is in stock, or to place an
        order, the workshop answers on WhatsApp.
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
