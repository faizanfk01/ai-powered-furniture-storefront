"use client";

import {
  Children,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * The reviews, as a rail you scroll sideways rather than a grid you scroll past.
 *
 * WHY A RAIL. A three-up grid of reviews spends a whole screen of a phone on
 * evidence the visitor did not ask for, and it puts a hard ceiling on how many
 * reviews the home page can carry — six already ran two rows deep on a laptop.
 * A rail shows two or three, says plainly that there are more, and costs one
 * band of the page however many there are.
 *
 * WHAT MAKES IT SCROLLABLE ON EACH INPUT, because a horizontal scroller that
 * only answers to one of them is the usual way this component goes wrong:
 *
 *   - Touch: the swipe every phone user already makes, with scroll snapping so
 *     a card lands aligned instead of half off the edge.
 *   - Mouse: the arrows below. A trackpad can swipe horizontally and a mouse
 *     wheel cannot, so on a desktop the arrows are not a nicety — without them
 *     the reviews past the fold are unreachable for anyone who does not think
 *     to drag the scrollbar.
 *   - Keyboard: the rail is a focusable region with a label, so tabbing to it
 *     and pressing the arrow keys scrolls it. A scroll container that cannot
 *     be reached by keyboard is a section of the page a keyboard user simply
 *     does not get, which is why the browsers now warn about it.
 *
 * The arrows appear ONLY when there is something they could reach. Two reviews
 * on a wide monitor fit side by side with room to spare; a pair of dead arrows
 * under them would be an affordance for a thing that cannot happen.
 *
 * NOT WHERE THE EMPTY STATES LIVE. Zero reviews omits the whole section and
 * one review is a single pull quote — both decided in app/(storefront)/page.tsx,
 * where the section itself is decided. This component is only ever handed the
 * case it is for: several reviews, in a row.
 *
 * IT TAKES CARDS, NOT REVIEWS, and that is a constraint rather than a taste.
 * <Testimonial> links to the piece a review is about via productPath(), which
 * lives in lib/url.ts alongside siteOrigin() — and that module imports
 * next/headers at the top, so the whole file is server-only. Importing
 * <Testimonial> from this client component would drag next/headers into the
 * browser bundle and the build fails outright. Passing the rendered cards in
 * as children keeps them server-rendered, which is also where they belong:
 * nothing about a review card is interactive, and the only JavaScript this
 * section needs is the scrolling.
 */
export function TestimonialRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLUListElement>(null);
  const railId = useId();

  // `scrollable` gates the arrows; the two edge flags disable them at the
  // ends. All three are derived from the DOM rather than from the review
  // count, because whether the rail overflows depends on the width it got.
  const [scrollable, setScrollable] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    // The furthest scrollLeft can go. Sub-pixel layout means this is never
    // hit exactly, hence the 1px tolerance on both ends — without it the
    // "next" arrow stays enabled forever at the right-hand end.
    const max = rail.scrollWidth - rail.clientWidth;

    setScrollable(max > 1);
    setAtStart(rail.scrollLeft <= 1);
    setAtEnd(rail.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    measure();

    // Watching the CARDS as well as the rail. The rail's own box stops
    // changing once the viewport settles, but a card can still grow — a web
    // font swapping in reflows the quotes and changes whether the row
    // overflows at all. Observing only the container would leave the arrows
    // in whatever state the first measurement caught.
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    for (const card of rail.children) observer.observe(card);

    return () => observer.disconnect();
  }, [measure]);

  /**
   * One card and one gap per press, so the rail advances by a unit the eye
   * can follow rather than by an arbitrary fraction of the viewport. Measured
   * from the DOM so the card width stays a styling decision.
   */
  function page(direction: 1 | -1) {
    const rail = railRef.current;
    if (!rail) return;

    const card = rail.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 0;
    const step = card ? card.offsetWidth + gap : rail.clientWidth * 0.8;

    rail.scrollBy({
      left: step * direction,
      // Smooth is the whole point of the arrows — it shows the reader that
      // the row moved and which way. Under reduced motion it is exactly the
      // kind of movement that setting asks us not to make.
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <div>
      <ul
        ref={railRef}
        id={railId}
        onScroll={measure}
        // A scroll container is a region a keyboard user has to be able to
        // enter. The label is what they hear when they arrive in it.
        tabIndex={0}
        role="group"
        aria-label="Customer reviews"
        // THE PAGE MUST NOT SCROLL SIDEWAYS — only this row.
        //
        // `overflow-x-auto` keeps the overflow inside this element's own box,
        // which is bounded by Container's gutter, so the document's
        // scrollWidth never grows. `overscroll-x-contain` is the second half:
        // without it a swipe that reaches the end of the rail chains to the
        // document behind it, which on a phone browser is the back gesture.
        //
        // `py-1 -my-1` is not spacing. `overflow-x` other than visible forces
        // `overflow-y` to auto, so the cards' shadows would be clipped flat
        // against the top and bottom edges of the scroll box; the padding
        // gives them somewhere to fall and the negative margin gives the space
        // straight back to the layout.
        className="rail-scroll -my-1 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain py-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass xl:gap-5"
      >
        {/* The rail owns the <li> and its width, not the page. How wide a
            card is and where it snaps are facts about this row; the page's job
            is to say which reviews are in it. Children.map derives the wrapper
            keys from the children's own, so the page still keys by review id.

            A percentage below `sm` so the next card always peeks past the
            gutter — that sliver is what tells a phone reader to swipe, and it
            is the only affordance touch gets. Fixed widths above it, because a
            percentage of a 1728px monitor is a review card the width of a
            paragraph of a broadsheet. */}
        {Children.map(children, (card) => (
          <li className="w-[84%] max-w-full shrink-0 snap-start sm:w-80 lg:w-[22rem] xl:w-96">
            {card}
          </li>
        ))}
      </ul>

      {/* Rendered only when the rail actually overflows, and only from `sm`
          up: below that the swipe is the control, and a phone does not need
          two of them competing for the same 40px. */}
      {scrollable && (
        <div className="mt-5 hidden items-center gap-2 sm:flex">
          <RailArrow
            direction="previous"
            controls={railId}
            disabled={atStart}
            onClick={() => page(-1)}
          />
          <RailArrow
            direction="next"
            controls={railId}
            disabled={atEnd}
            onClick={() => page(1)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * One scroll control.
 *
 * Deliberately NOT the Button primitive. That component is a text button —
 * its three sizes are all horizontal padding around a label, and every one of
 * them would have to be overridden to reach a square. This is a 40px icon
 * control, which is a different object; what it borrows from the system is
 * the tokens, the focus ring and the disabled treatment, which is the part
 * that has to match.
 */
function RailArrow({
  direction,
  controls,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  controls: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const next = direction === "next";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-controls={controls}
      aria-label={next ? "Next reviews" : "Previous reviews"}
      className="inline-flex size-10 items-center justify-center rounded-full border border-line-strong bg-paper text-ink transition-colors duration-150 hover:border-ink/40 hover:bg-surface disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={next ? "M9 5l7 7-7 7" : "M15 5l-7 7 7 7"} />
      </svg>
    </button>
  );
}
