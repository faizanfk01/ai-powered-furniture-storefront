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
 * Server component. Only the mobile panel and the two client leaves need
 * state — a `"use client"` on this file would ship the whole header, the
 * wordmark and the nav data to the browser for one toggle.
 */
export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-paper/10 bg-ink text-paper"
      style={{ "--header-height": "4.5rem" } as React.CSSProperties}
    >
      <Container>
        <div className="flex h-[var(--header-height)] items-center justify-between gap-6">
          <Wordmark tone="paper" />

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

          <div className="flex items-center gap-2">
            <AskAiButton className="hidden sm:inline-flex" />
            <MobileNav />
          </div>
        </div>
      </Container>
    </header>
  );
}
