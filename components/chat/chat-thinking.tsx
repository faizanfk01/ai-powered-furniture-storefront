"use client";

import { useEffect, useState } from "react";

/**
 * What the panel shows while the answer is being worked out.
 *
 * WHY THIS IS NOT A STREAMING CURSOR. The obvious thing for a chat is to
 * stream tokens, and this one deliberately does not — because the reply is not
 * trustworthy until it is complete. lib/ai/grounding.ts checks the finished
 * text and DISCARDS it if the model invented a price or cited a product that
 * was never retrieved. Streaming would put those words on the customer's
 * screen a second before we decided to throw them away, and "Rs 45,000" read
 * and then retracted is worse than three seconds of waiting. The one guarantee
 * this whole phase exists to make is incompatible with showing work in
 * progress, so the wait is made honest instead of hidden.
 *
 * A turn is one to three seconds in practice. The staged label is for the
 * times it is not: silence that lasts long enough to look broken is the thing
 * being designed against, and a message that changes proves the panel is still
 * alive in a way a looping animation cannot.
 *
 * RESTYLED ONLY. The three stages, their timings and the live region are
 * unchanged; the marks beside the label are now dots rather than ruler ticks.
 */

const STAGES = [
  { after: 0, label: "Checking the catalogue" },
  { after: 4000, label: "Still checking" },
  { after: 10_000, label: "Taking longer than usual" },
] as const;

export function ChatThinking() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timers = STAGES.slice(1).map((entry, index) =>
      setTimeout(() => setStage(index + 1), entry.after),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    // role="status" is an implicit polite live region, so the stage label is
    // announced when it changes. That matters more here than anywhere else in
    // the panel: a screen-reader user gets no spinner, and without this the
    // wait is entirely silent.
    <div role="status" className="flex items-center gap-2.5 px-1">
      {/* Three dots, the plain and universally read version of "working".
          It was the measure's brass ruler ticks — the site's own ornament
          doing a job, which was right when the ornament was the identity.
          Decorative, so it is hidden from the accessibility tree — the label
          beside it is what a screen reader should read, once. */}
      <span aria-hidden="true" className="flex items-center gap-1">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-[chat-dot_1.2s_ease-in-out_infinite] rounded-full bg-muted"
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
      </span>

      <span className="text-sm text-muted">{STAGES[stage].label}</span>
    </div>
  );
}
