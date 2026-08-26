import { Container } from "@/components/ui/container";
import { NAV_LINKS } from "@/lib/site";

import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { Wordmark } from "./wordmark";

/**
 * The header bar.
 *
 * Sticky, on a translucent paper ground with a hairline under it. Sticky
 * because the catalogue is a long scroll and the way back to the rest of the
 * site should not require returning to the top; quiet, because a showroom's
 * signage does not follow you around shouting.
 *
 * The `--header-height` variable is set here and read by the mobile panel, so
 * the panel starts exactly below the bar instead of guessing at a number that
 * drifts the first time the padding changes.
 *
 * Server component. Only the mobile panel needs state, and it is its own
 * island — a `"use client"` on this file would ship the whole header, the
 * wordmark and the nav data to the browser for one toggle.
 */
export function SiteHeader() {
  return (
    <header
      className="sticky top-0 z-40 border-b border-hairline bg-paper/90 backdrop-blur-sm"
      style={{ "--header-height": "4.5rem" } as React.CSSProperties}
    >
      <Container>
        <div className="flex h-[var(--header-height)] items-center justify-between gap-8">
          <Wordmark />

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </nav>

          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
