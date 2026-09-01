import Image from "next/image";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";

/**
 * The photographic hero shared by Home, Custom Orders, About and Contact.
 *
 * ONE COMPONENT, FOUR PAGES — deliberately, because the thing that makes four
 * heroes read as one design is not four pages agreeing to use the same numbers,
 * it is there being only one set of numbers. The overlay in particular has to
 * be identical everywhere: a band that is 5% lighter on one page does not look
 * like a lighter band, it looks like a different site.
 *
 * FULL BLEED, unlike everything else on the site. The image is a background,
 * not content, so holding it to the page frame would put a photograph in a box
 * under a dark header and leave a white margin either side of a dark band. The
 * TEXT still sits in the standard Container, so the words line up with every
 * band below them — only the ink and the photograph run to the bezel.
 *
 * IT CONTINUES THE HEADER. The header is `bg-ink text-paper` and sticks; the
 * hero is the same ink with a photograph showing through it. The two read as
 * one dark opening, which is why the section carries `bg-ink` on its own — if
 * the image 404s or is still decoding, the band is dark and the white text is
 * still readable rather than white-on-white.
 */

/**
 * THE OVERLAY, in two layers, and why it is two.
 *
 * A single flat scrim strong enough for the worst pixel in the worst image
 * flattens all four photographs into grey. A single gradient light enough to
 * show texture on the right leaves the left — where every word of every hero
 * sits — at the mercy of whatever happens to be in that corner of the picture.
 * So: a flat floor, plus a wedge that thickens toward the text.
 *
 *   flat      65% on small screens, 55% from lg
 *   wedge     45% at the left edge, 25% mid, 5% at the right
 *
 * Composited (1 - (1-a)(1-b)) that is 81% behind the text on a phone and 75%
 * on a desktop, easing to 67% / 57% at the right-hand edge where nothing but
 * the photograph is. The small end is the darker one because a phone has no
 * right-hand edge to spare: the heading reflows across the full column, so the
 * text zone IS the whole band and the wedge alone cannot cover it.
 *
 * These numbers were not guessed. scripts/hero-contrast.mjs samples the actual
 * object-cover crop of each of the four files at phone and desktop widths,
 * composites these exact layers over it, and reports the worst-case contrast
 * of the heading and the lede against the brightest patch they cross. See that
 * file for the measured result before changing anything here.
 */
const OVERLAY_FLAT = "bg-ink/65 lg:bg-ink/55";
const OVERLAY_WEDGE = "bg-linear-to-r from-ink/45 via-ink/25 to-ink/5";

export function PageHero({
  src,
  alt,
  /**
   * Where `object-cover` keeps the crop. Centre suits a subject that spans the
   * frame; a picture whose subject sits low has to say so, or the band's own
   * proportions crop away the thing it is a picture of.
   */
  position = "object-center",
  children,
}: {
  src: string;
  alt: string;
  position?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <Image
        src={src}
        alt={alt}
        fill
        // The hero of the page — it is the largest thing in the first screen
        // and it is what LCP measures. `priority` is deprecated in Next 16 in
        // favour of saying what you mean.
        loading="eager"
        fetchPriority="high"
        // Full bleed at every width, so the viewport IS the layout width.
        sizes="100vw"
        className={`${position} object-cover`}
      />

      <div aria-hidden className={`absolute inset-0 ${OVERLAY_FLAT}`} />
      <div aria-hidden className={`absolute inset-0 ${OVERLAY_WEDGE}`} />

      {/* `relative` puts the words above two absolutely-positioned siblings
          without a z-index race — same stacking level, later in the DOM. */}
      <Container className="relative">
        {/* min-h gives the band presence on the short pages (Contact is four
            lines of text) and stops climbing at lg, so a tall monitor gets a
            hero rather than a title screen. Pages whose copy is taller than
            the floor — Home, with a three-line heading and two buttons — set
            their own height by simply being that tall. */}
        <div className="flex min-h-96 flex-col justify-center py-16 sm:min-h-[28rem] sm:py-20 lg:min-h-[32rem] lg:py-24">
          {children}
        </div>
      </Container>
    </section>
  );
}
