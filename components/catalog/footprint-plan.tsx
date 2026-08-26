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
 *   A quiet branded panel says the photograph is coming. It never renders a
 *   guessed rectangle: an invented footprint is a picture of furniture that
 *   does not exist, and nothing downstream could tell it from a real one.
 *
 * Both states occupy the same 4:3 box, so a mixed grid stays on its baseline.
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
  const padding = size === "detail" ? "px-16 py-14" : "px-10 py-8";

  if (!footprint) {
    return (
      <div
        className={`flex aspect-4/3 flex-col items-center justify-center gap-3 bg-hairline/60 ${className}`}
      >
        {/* The measure, alone — the brand's mark standing in for the drawing
            we cannot make. */}
        <div aria-hidden="true" className="text-brass">
          <div className={`measure ${size === "detail" ? "w-24" : "w-16"}`} />
        </div>
        <span className="spec-label text-muted">Photograph to come</span>
      </div>
    );
  }

  const scale = footprintScale(footprint.width);

  return (
    <div
      className={`flex aspect-4/3 items-center justify-center bg-hairline/60 ${padding} ${className}`}
      // One sentence for a screen reader, instead of it walking the tick marks
      // and axis labels of a drawing that means nothing read aloud.
      role="img"
      aria-label={`Plan view: ${footprint.width} inches wide by ${footprint.depth} inches deep`}
    >
      <div aria-hidden="true" className="w-full">
        <div
          className="relative mx-auto border border-ink/25 bg-paper"
          style={{
            aspectRatio: `${footprint.width} / ${footprint.depth}`,
            width: scale,
          }}
        >
          {/* Depth, read down the right edge like a drawing callout. */}
          <span className="spec-label absolute top-1/2 -right-2 origin-right translate-x-full -translate-y-1/2 rotate-90 text-muted">
            {footprint.depth}&quot;
          </span>
        </div>

        <div className="mx-auto text-brass" style={{ width: scale }}>
          <div className="measure mt-2" />
          <span className="spec-label mt-1 block text-center text-muted">
            {footprint.width}&quot;
          </span>
        </div>
      </div>
    </div>
  );
}
