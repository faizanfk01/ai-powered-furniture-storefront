/**
 * "Ask AI about this piece" — present, styled, and deliberately not wired up.
 * Phase 3 gives it a chat to open.
 *
 * TREATMENT, and why this one:
 *
 * The obvious option is `disabled`, but a disabled button is removed from the
 * tab order — a keyboard or screen-reader user would never find out the
 * feature exists, and would just meet a dead region of the page. So it stays
 * focusable with `aria-disabled`, which announces it as unavailable while
 * still letting it be discovered.
 *
 * `type="button"` with no handler does nothing when clicked, so there is no
 * JavaScript here at all — this remains a Server Component.
 *
 * The "Soon" mark is what keeps it from reading as broken. A greyed control
 * with no explanation is a bug; a greyed control that says when it arrives is
 * a roadmap. It sits beside the label rather than replacing it, so the button
 * still says what it will do.
 */
export function AskAiButton() {
  return (
    <div>
      <button
        type="button"
        aria-disabled="true"
        className="inline-flex w-full cursor-not-allowed items-center justify-center gap-3 border border-ink/15 px-6 py-3 font-display text-sm font-medium tracking-wide text-muted uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
      >
        Ask AI about this piece
        <span className="spec-label border border-brass/40 px-2 py-0.5 text-brass">
          Soon
        </span>
      </button>

      <p className="mt-2 text-sm text-muted">
        Answers about size, materials and lead time — without waiting for a
        reply. In the meantime, the workshop answers on WhatsApp.
      </p>
    </div>
  );
}
