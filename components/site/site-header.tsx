import { Container } from "@/components/ui/container";
import { NAV_LINKS } from "@/lib/site";

import { AskAiButton } from "./ask-ai-button";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { Wordmark } from "./wordmark";

/**
 * The header bar.
 *
 * Sticky, and now a solid ink bar with a paper hairline under it. It used to
 * be translucent paper on the page ground — right for the showroom identity,
 * where the whole site was one warm surface. In the clean direction the page
 * is white and the brand colour lives in the chrome, so the header is the
 * brand: dark band, wordmark left, nav and the one action right.
 *
 * Solid rather than translucent on purpose. A blurred bar over a white page
 * with photographs scrolling under it produces a header whose contrast changes
 * as you scroll, and the nav labels are the one thing on the page that must
 * never get harder to read.
 *
 * The `--header-height` variable is set here and read by the mobile panel, so
 * the panel starts exactly below the bar instead of guessing at a number that
 * drifts the first time the padding changes.
 *
 * IT IS NOW A CLASS, NOT AN INLINE STYLE. A `style` attribute holds one value
 * for every screen, and 4.5rem is a desktop bar: on a 390px phone it spent 72px
 * of a 700px screen on a wordmark and a hamburger. Written as an arbitrary
 * property utility it can take a breakpoint, so the bar is 60px on a phone and
 * the old 72px from `sm` up. The mobile panel reads the variable either way and
 * needed no change.
 *
 * Server component. Only the mobile panel and the two client leaves need
 * state — a `"use client"` on this file would ship the whole header, the
 * wordmark and the nav data to the browser for one toggle.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-paper/10 bg-ink text-paper [--header-height:3.75rem] sm:[--header-height:4.5rem]">
      <Container>
        {/* `gap-3` on a phone, not `gap-6`. At 320px the wordmark, a 24px gap
            and a 40px tap target did not fit between the gutters, and the row
            pushed the document into a horizontal scroll. */}
        <div className="flex h-[var(--header-height)] items-center justify-between gap-3 sm:gap-6">
          {/* min-w-0 so the name is what gives way if anything has to: the
              hamburger below is shrink-0 and must keep its full 40px. */}
          <div className="min-w-0">
            <Wordmark tone="paper" />
          </div>

          {/* The nav sits centred-ish rather than hard right, with the action
              after it — the arrangement every storefront header has settled
              on, because the links are navigation and the button is not. */}
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* Hidden below sm, where the mobile panel carries its own Ask AI
                and this one was only costing width. It was written that way
                before and did not work — see the note in ask-ai-button.tsx. */}
            <AskAiButton className="hidden sm:inline-flex" />
            <MobileNav />
          </div>
        </div>
      </Container>
    </header>
  );
}
