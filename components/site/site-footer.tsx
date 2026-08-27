import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import {
  HOURS,
  LOCATIONS,
  NAV_LINKS,
  SITE,
  WHATSAPP_DISPLAY,
  whatsappUrl,
} from "@/lib/site";

import { WhatsAppIcon } from "./whatsapp-icon";
import { Wordmark } from "./wordmark";

/**
 * The footer.
 *
 * Carries the two addresses at equal weight, the WhatsApp action, and the
 * hours — the three things somebody scrolls to the bottom looking for. On the
 * deepest ink band, one step darker than the header, so the page is bounded
 * top and bottom by the brand with the white content between.
 *
 * Four columns on a wide screen, two on a tablet, one stacked on a phone. The
 * ruler mark that opened it and the tracked-out capitals on the column
 * headings are gone: the headings are now just small semibold labels, which is
 * what a retail footer uses and what keeps four columns of short text
 * scannable.
 *
 * The addresses stay as plain <address> elements rather than a styled <div>
 * soup: a browser's reader mode and a screen reader both treat contact details
 * as a distinct kind of content.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink-deep text-paper">
      <Container>
        <div className="py-14 sm:py-16">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
            {/* Identity and the one action. */}
            <div className="sm:col-span-2 lg:col-span-4">
              <Wordmark tone="paper" />

              <p className="mt-3 max-w-xs text-sm leading-relaxed text-paper/65">
                {SITE.tagline}
              </p>

              <Button
                variant="outline-invert"
                href={whatsappUrl(
                  "Hello Standard Furniture — I have a question.",
                )}
                className="mt-5"
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>

              <p className="mt-3 text-sm text-paper/50 tabular">
                {WHATSAPP_DISPLAY}
              </p>
            </div>

            {/* Both places. Neither is "the" address. */}
            {LOCATIONS.map((location) => (
              <div key={location.label} className="lg:col-span-3">
                <h2 className="text-sm font-semibold text-paper">
                  {location.label}
                </h2>
                <p className="mt-1 text-sm text-paper/45">{location.role}</p>
                <address className="mt-2 text-sm leading-relaxed not-italic text-paper/75">
                  {location.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            ))}

            {/* Hours. */}
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-paper">Hours</h2>
              <div className="mt-2 text-sm leading-relaxed text-paper/75">
                {HOURS.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </div>
              {!HOURS.confirmed && (
                <p className="mt-2 text-sm text-brass/80">To be confirmed</p>
              )}
            </div>
          </div>

          {/* Sitemap and the legal line. The nav stays on the LEFT: the
              floating chat launcher is fixed to the bottom-right corner, and
              anything put on that side of this row ends up underneath it. */}
          <div className="mt-12 flex flex-col gap-4 border-t border-paper/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-6 gap-y-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-paper/60 transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <p className="text-sm text-paper/40">
              © {year} {SITE.name}, {SITE.town}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
