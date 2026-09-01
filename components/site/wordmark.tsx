import Image from "next/image";
import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * The name, set as a retail wordmark: the gold crest, then "Standard
 * Furniture" in Great Vibes.
 *
 * Was Archivo on its width axis, uppercase and letter-spaced — signage for the
 * showroom identity. Then Inter throughout, sentence case, semibold. It keeps
 * that shape and carries the two things a furniture shop in Mardan is actually
 * recognised by: the crest, and the shop's own script.
 *
 * ONE FACE ACROSS BOTH WORDS. This briefly set "Standard" in script and
 * "Furniture" in Inter, on the argument that the split was the ornament. The
 * split is gone: the mark reads as one name now, and the two words are told
 * apart by TONE rather than by face — "Furniture" steps back to muted ink, or
 * to paper/65 on a dark band. That is a quieter distinction than a change of
 * typeface, and a wordmark is the one place on a site that should read as a
 * single object rather than as two things next to each other.
 *
 * THE SCRIPT RUNS LARGER, AND HAS TO. Great Vibes has a small x-height inside
 * a tall em, so at a sans-serif's font-size it reads about two-thirds the size.
 * `text-[1.7em]` sizes it from whatever step the link is on, so the ratio holds
 * at all three breakpoints and there is one number to tune, not three.
 * `leading-none` keeps its ascenders and descenders out of the line box: the
 * header bar is a fixed height and a taller line box would push the baseline
 * off centre.
 *
 * Tracking is reset on both spans. The link tracks -0.02em, which was right for
 * Inter and is wrong for a face whose letters join — negative tracking on a
 * script collides the strokes.
 *
 * `whitespace-nowrap` is deliberate: the two words are one mark and must never
 * wrap to a second line inside the bar.
 */

/**
 * Shared by both words, so they can never drift apart. Only the colour differs.
 *
 * The family is reached as an arbitrary value rather than through a
 * `--font-script` theme token. A token would put a `font-script` utility on
 * every element on the site, and a script face that is one utility away from a
 * heading does not stay in the wordmark.
 *
 * WHY THE WORDS ARE NUDGED DOWN — the one number here that is not obvious.
 *
 * Great Vibes reserves a deep descender in its em box, and "Standard Furniture"
 * contains no descender at all: no g, j, p, q or y. So the visible ink fills
 * the top of the line box and leaves the bottom third empty. Centring the row
 * then centres the BOX, and the eye sees the words riding high while the crest
 * hangs low — measured at 12.3px apart on desktop and 9.8px on phone before
 * this, in both the navbar and the footer.
 *
 * No alignment keyword fixes that, because nothing is misaligned in layout
 * terms: `items-center` centres the boxes correctly, `items-baseline` sits them
 * on a shared baseline correctly, and the ink is off-centre inside the box
 * either way. The empty space has to be paid back explicitly, which is what a
 * lockup normally does by hand.
 *
 * 0.36em of the SCRIPT's own size, applied to the words rather than to the
 * crest. Two reasons for that direction: the crest is already centred in the
 * bar, so moving it up instead would leave it 3px from the top edge of a 72px
 * header; and an em on this span scales with the script, so the same constant
 * holds at all three breakpoints instead of needing a value per step.
 */
const SCRIPT =
  "font-[family-name:var(--font-great-vibes)] translate-y-[0.36em] text-[1.7em] leading-none font-normal tracking-normal";

export function Wordmark({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "paper";
  className?: string;
}) {
  const paper = tone === "paper";

  return (
    <Link
      href="/"
      className={`inline-flex items-baseline gap-[0.3em] text-base font-semibold whitespace-nowrap tracking-[-0.02em] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass sm:text-lg lg:text-xl ${
        paper ? "text-paper" : "text-ink"
      } ${className}`}
    >
      {/* The crest, sized in em from the link's own step so it grows with the
          name across the breakpoints instead of being three fixed pixel values
          that drift the first time the type scale moves.

          2.4em, matched to the SCRIPT ABOVE, NOT to the link's step. The
          script's visual height is roughly the cap of its own 1.7em, so a mark
          sized off the link's 1em base — 1.55em, where this started — read as a
          bullet point beside the name rather than as half of it. 2.4em spans
          the script's whole ascender-to-descender, which is what makes the two
          read as one lockup. It stops there: 2.7em was tried and leaves 9px of
          clearance in a 72px bar, which turns the crest into the thing setting
          the header's height.

          `shrink-0` because the header gives this row a min-w-0 and the name is
          what should give way at 320px, never the mark. `self-center` because
          the row aligns on the text baseline and an image has no baseline worth
          aligning to — its bottom edge would sit on it and float the crest.

          It is not the link's accessible name — the two words below are, and a
          second copy in the alt would make screen readers say the shop's name
          twice on every page. Hence alt="" and aria-hidden: the mark is
          decoration beside a name that is already text. */}
      <Image
        src="/logo/logo-mark.png"
        alt=""
        aria-hidden
        width={512}
        height={512}
        priority
        sizes="80px"
        className="size-[2.4em] shrink-0 self-center object-contain"
      />

      <span className={SCRIPT}>Standard</span>
      <span className={`${SCRIPT} ${paper ? "text-paper/65" : "text-muted"}`}>
        Furniture
      </span>
      <span className="sr-only">, {SITE.town}</span>
    </Link>
  );
}
