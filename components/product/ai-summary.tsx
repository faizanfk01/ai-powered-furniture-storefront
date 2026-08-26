import { Measure } from "@/components/ui/measure";

/**
 * The AI summary panel.
 *
 * `Product.aiSummary` is nullable and stays null until Phase 3 generates it, so
 * this component is built for both states now and the layout will not move
 * when the column fills. The empty state is not a spinner or a grey bar
 * pretending to load — nothing is loading, and a skeleton that never resolves
 * is a lie the page tells for as long as the column is null.
 *
 * Instead the empty state does what an empty state should: it points at what
 * the reader can do right now, which is read the maker's own description
 * directly below.
 *
 * The disclosure line is deliberate and permanent. A summary a machine wrote
 * about a piece of furniture should say so, on a site whose entire proposition
 * is that real people build the thing in Baghdada.
 */
export function AiSummary({ summary }: { summary: string | null }) {
  return (
    <section
      aria-labelledby="ai-summary-heading"
      className="border border-hairline bg-hairline/25 p-6 sm:p-8"
    >
      <Measure width="w-16" />

      <h2 id="ai-summary-heading" className="spec-label mt-4 text-muted">
        The short version
      </h2>

      {summary ? (
        <>
          <p className="mt-4 text-lg leading-relaxed text-ink">{summary}</p>
          <p className="spec-label mt-5 text-muted/70">
            Written by AI from this product&rsquo;s details
          </p>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            A short summary of this piece hasn&rsquo;t been written yet. The
            full description below is the workshop&rsquo;s own account of how it
            is built.
          </p>
          <p className="spec-label mt-5 text-brass/80">Summary coming soon</p>
        </>
      )}
    </section>
  );
}
