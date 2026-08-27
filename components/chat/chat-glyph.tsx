/**
 * The assistant's mark.
 *
 * Square-cornered, hairline weight, with the two "text" strokes in brass — the
 * same geometry as the measure and the footprint plans, rather than the
 * rounded bubble every chat widget on the internet uses.
 *
 * Its own file because both AI entry points wear it: the floating launcher for
 * the global drawer, and the "Ask AI about this piece" button on a product
 * page. It was inlined in each of them, which is two drawings of one mark.
 */
export function ChatGlyph({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1.5 1.5h13v9.5h-8L3 14.5V11H1.5z" />
      <path d="M4.5 5h7M4.5 7.75h4.5" stroke="#b98d4e" />
    </svg>
  );
}
