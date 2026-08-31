"use client";

import { useChat } from "@/components/chat/chat-context";
import { ChatGlyph } from "@/components/chat/chat-glyph";

/**
 * The header's "Ask AI" trigger.
 *
 * NO NEW WIRING. It calls the same `setOpen` from ChatProvider that the
 * floating launcher in components/chat/chat-widget.tsx already calls — the
 * door chat-context.tsx says in its own comment it was left open for ("a
 * header or nav trigger for it is the obvious next thing to want"). The
 * drawer, its transcript and its close behaviour are untouched; this is a
 * second handle on the same door.
 *
 * Styled as the header's one outlined action: a hairline in paper rather than
 * a filled button, because a solid button in the corner of a dark bar would
 * outrank the wordmark and the nav it sits beside.
 *
 * THE DISPLAY UTILITY LIVES IN `className`, AND HAS TO.
 *
 * It used to be baked into the base list as `inline-flex`, with the header
 * passing `hidden sm:inline-flex` to take it off small screens. That never
 * worked. Two unprefixed display utilities on one element have identical
 * specificity, so the winner is whichever Tailwind emits LAST in the sheet —
 * and that is `inline-flex`, not `hidden`. The button was therefore visible at
 * every width, and at 320px it was the thing that pushed the header row past
 * the viewport and gave the whole storefront a horizontal scrollbar.
 *
 * Moving it into the default `className` means there is only ever ONE
 * unprefixed display utility on the element: the caller's. `hidden` then wins
 * below sm because nothing competes with it, and `sm:inline-flex` wins above it
 * because a variant utility is emitted after the plain one.
 */
export function AskAiButton({
  /** Must carry a display utility — the base list deliberately has none. */
  className = "inline-flex",
}: {
  className?: string;
}) {
  const { setOpen } = useChat();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`items-center gap-2 rounded-lg border border-paper/25 px-3 py-2 text-sm font-medium whitespace-nowrap text-paper transition-colors hover:border-paper/50 hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:px-3.5 ${className}`}
    >
      <ChatGlyph className="size-4" />
      Ask AI
    </button>
  );
}
