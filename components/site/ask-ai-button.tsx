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
 */
export function AskAiButton({ className = "" }: { className?: string }) {
  const { setOpen } = useChat();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`inline-flex items-center gap-2 rounded-lg border border-paper/25 px-3.5 py-2 text-sm font-medium text-paper transition-colors hover:border-paper/50 hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${className}`}
    >
      <ChatGlyph className="size-4" />
      Ask AI
    </button>
  );
}
