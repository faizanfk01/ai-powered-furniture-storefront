"use client";

import { useChat } from "@/components/chat/chat-context";

/**
 * "Ask AI about this piece" — now wired to the sitewide chat panel.
 *
 * Was a deliberate placeholder through Phase 4b: focusable but `aria-disabled`,
 * with a "Soon" mark beside it, because a greyed control with no explanation
 * reads as a bug while one that says when it arrives reads as a roadmap. Phase
 * 3 Step 4 is when it arrives, so the mark and the disabled state both go — a
 * "Soon" badge on a working button is worse than never having shown one.
 *
 * SECONDARY, AND IT STAYS SECONDARY. The outline treatment is unchanged and
 * the solid "Enquire on WhatsApp" above it is still the only filled button on
 * the page. Nothing here should suggest the assistant is how you buy: it
 * answers questions about the piece, and every path to an actual order still
 * goes through a person on WhatsApp (CLAUDE.md → Payments). The supporting
 * line under the button says so in as many words.
 *
 * A Client Component, and the only one this page gains — the product page
 * around it stays server-rendered.
 */
export function AskAiButton({ productName }: { productName: string }) {
  const { askAbout } = useChat();

  return (
    <div>
      <button
        type="button"
        onClick={() => askAbout(productName)}
        className="inline-flex w-full items-center justify-center gap-2.5 border border-ink/25 px-6 py-3 font-display text-sm font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
      >
        {/* The launcher's glyph, so the button and the panel it opens are
            visibly the same thing. */}
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
        Ask AI about this piece
      </button>

      <p className="mt-2 text-sm text-muted">
        Answers about size, materials and options, from this page&rsquo;s own
        details. For a price, availability or an order, the workshop answers on
        WhatsApp.
      </p>
    </div>
  );
}
