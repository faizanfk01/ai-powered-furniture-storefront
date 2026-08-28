/**
 * The tappable chip row.
 *
 * Presentation only. It is handed strings and a callback, and the callback it
 * is handed by ChatConversation is the same `send` the composer's form calls —
 * so a tap and a typed message are the same event by the time either leaves
 * this file. See components/chat/suggestions.ts for where the strings come
 * from and why none of them come from the model.
 *
 * REAL BUTTONS, not links or divs. A chip asks a question; it does not
 * navigate. That gets keyboard focus, Enter and Space, and the right role
 * announced, without any of it being reimplemented.
 *
 * SIZED FOR A THUMB. `min-h-10` is 40px, which is the floor for a control that
 * most of this shop's customers will hit on a phone while holding it in one
 * hand — the chips sit directly above the composer, which is the busiest
 * corner of the screen, and a 28px pill there is a mis-tap waiting to happen.
 * They wrap rather than scroll horizontally: a hidden third chip off the right
 * edge is a chip nobody taps.
 *
 * The pill itself is the catalogue's category pill at a touch size — same
 * radius, same hairline, same hover — so a customer who has used the filter
 * row recognises these as the same kind of control.
 */
export function SuggestionChips({
  suggestions,
  onPick,
  label,
  labelHidden = false,
  className = "",
}: {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  /** Names the group. Shown on the empty state, screen-reader only after a reply. */
  label: string;
  labelHidden?: boolean;
  className?: string;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div className={className}>
      <p className={labelHidden ? "sr-only" : "text-sm font-semibold text-ink"}>
        {label}
      </p>

      <ul className={`flex flex-wrap gap-2 ${labelHidden ? "" : "mt-2.5"}`}>
        {suggestions.map((suggestion) => (
          <li key={suggestion}>
            <button
              type="button"
              onClick={() => onPick(suggestion)}
              className="inline-flex min-h-10 items-center rounded-full border border-hairline bg-paper px-3.5 py-2 text-left text-sm text-ink shadow-sm transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
