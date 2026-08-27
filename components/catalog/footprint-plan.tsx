import { footprintScale, parseFootprint } from "@/lib/footprint";

/**
 * What sits where a photograph will go.
 *
 * Two states, and the distinction is the point:
 *
 *   PLAN — the dimensions parsed, so the piece is drawn in plan at true
 *   proportion, scaled against the catalogue's common 120" ruler. This is not
 *   a placeholder pretending to be an image; it is the single most useful
 *   thing we can show about a piece of furniture whose photo we do not yet
 *   have, because "will it fit" is the first question anyone asks.
 *
 *   MARK — the dimensions were absent or unreadable, so nothing is drawn.
 *   A quiet panel says the photograph is coming. It never renders a guessed
 *   rectangle: an invented footprint is a picture of furniture that does not
 *   exist, and nothing downstream could tell it from a real one.
 *
 * Both states occupy the same 4:3 box, so a mixed grid stays on its baseline.
 *
 * RESTYLED, NOT REBUILT. The parser, the shared 120" ruler, the refusal to
 * guess and the two-state structure are all untouched. What changed is the
 * drawing: it was brass ticks and tracked-out capitals on a grey fill — the
 * showroom identity's ruler motif. It is now a plain drafting callout, a
 * hairline rectangle with a dimension line under it, on the light neutral
 * surface. Same information, and it now reads as a technical drawing rather
 * than as branding.
 */
export function FootprintPlan({
  dimensions,
  size = "card",
  className = "",
}: {
  dimensions: string | null;
  /**
   * `detail` is the same drawing with room to breathe — the product page gives
   * it most of a column, where the card gives it a third of one. Only the
   * padding changes: the plan stays on the catalogue's shared 120" ruler in
   * both places, so a piece is not quietly bigger on its own page.
   */
  size?: "card" | "detail";
  className?: string;
}) {
  const footprint = parseFootprint(dimensions);
  const padding = size === "detail" ? "px-16 py-14" : "px-10 py-9";

  if (!footprint) {
    return (
      <div
        className={`flex aspect-4/3 flex-col items-center justify-center gap-2.5 bg-surface ${className}`}
      >
        {/* An outline of a picture frame, at the weight of the drawing it is
            standing in for. The brand's ruler mark used to sit here; a mark
            that says "brand" where a customer is looking for "what does it
            look like" answers the wrong question. */}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`${size === "detail" ? "size-9" : "size-7"} text-line-strong`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M3.5 16.5l4.5-4 3.5 3 3-2.5 6 5" />
        </svg>
        <span className="text-xs text-muted">Photograph to come</span>
      </div>
    );
  }

  const scale = footprintScale(footprint.width);

  return (
    <div
      className={`flex aspect-4/3 items-center justify-center bg-surface ${padding} ${className}`}
      // One sentence for a screen reader, instead of it walking the tick marks
      // and axis labels of a drawing that means nothing read aloud.
      role="img"
      aria-label={`Plan view: ${footprint.width} inches wide by ${footprint.depth} inches deep`}
    >
      <div aria-hidden="true" className="w-full">
        <div
          className="relative mx-auto rounded-[3px] border border-line-strong bg-paper"
          style={{
            aspectRatio: `${footprint.width} / ${footprint.depth}`,
            width: scale,
          }}
        >
          {/* Depth, read down the right edge like a drawing callout. */}
          <span className="tabular absolute top-1/2 -right-2 origin-right translate-x-full -translate-y-1/2 rotate-90 text-[11px] text-muted">
            {footprint.depth}&quot;
          </span>
        </div>

        {/* The width dimension line: a rule between two end ticks, which is how
            a width is called out on a plan. Three positioned hairlines rather
            than the repeating-gradient `measure` utility — that drew a ruler,
            and a ruler is a different claim from a measurement. */}
        <div className="mx-auto" style={{ width: scale }}>
          <div className="relative mt-2.5 h-1.5">
            <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
            <div className="absolute inset-y-0 left-0 w-px bg-line-strong" />
            <div className="absolute inset-y-0 right-0 w-px bg-line-strong" />
          </div>
          <span className="tabular mt-1.5 block text-center text-[11px] text-muted">
            {footprint.width}&quot;
          </span>
        </div>
      </div>
    </div>
  );
}
