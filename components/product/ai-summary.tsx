/**
 * The AI summary panel.
 *
 * `Product.aiSummary` is nullable, so this component is built for both states
 * and the layout does not move when the column fills. The empty state is not a
 * spinner or a grey bar pretending to load — nothing is loading, and a
 * skeleton that never resolves is a lie the page tells for as long as the
 * column is null.
 *
 * Instead the empty state does what an empty state should: it points at what
 * the reader can do right now, which is read the maker's own description
 * beside it.
 *
 * The disclosure line is deliberate and permanent. A summary a machine wrote
 * about a piece of furniture should say so, on a site whose entire proposition
 * is that real people build the thing in Baghdada.
 *
 * RESTYLED ONLY. Both states, both strings and the disclosure are unchanged.
 * The panel is now the same tinted surface card the catalogue's made-to-measure
 * CTA uses, rather than a square hairline box opened by the ruler mark. It sits
 * on `surface` while the workshop's own description sits on white, which is the
 * quiet way of saying these two accounts of the piece came from different
 * places.
 */
export function AiSummary({ summary }: { summary: string | null }) {
  return (
    <section
      aria-labelledby="ai-summary-heading"
      className="rounded-xl border border-hairline bg-surface p-6 sm:p-8"
    >
      <h2
        id="ai-summary-heading"
        className="display-wide text-xl font-semibold"
      >
        The short version
      </h2>

      {summary ? (
        <>
          <p className="mt-3 leading-relaxed text-ink">{summary}</p>
          {/* The disclosure. Small, but never conditional and never removed. */}
          <p className="mt-5 text-sm text-muted">
            Written by AI from this product&rsquo;s details
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 leading-relaxed text-muted">
            We haven&rsquo;t written a short summary of this piece yet. The full
            description beside it is the workshop&rsquo;s own account of how it
            is built.
          </p>
          <p className="mt-5 text-sm text-accent-strong">Summary coming soon</p>
        </>
      )}
    </section>
  );
}
