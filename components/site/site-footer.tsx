import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
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
 * hours — the three things somebody scrolls to the bottom looking for. On an
 * ink band, so the page closes the way it opens.
 *
 * The addresses are marked up as microdata-free plain <address> elements
 * rather than a styled <div> soup: a browser's reader mode and a screen
 * reader both treat contact details as a distinct kind of content.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-ink-deep text-paper">
      <Container>
        <div className="py-16 sm:py-20">
          <Measure />

          <div className="mt-8 grid grid-cols-1 gap-12 md:grid-cols-12">
            {/* Identity and the one action. */}
            <div className="md:col-span-5">
              <Wordmark tone="paper" />

              <p className="mt-4 max-w-xs leading-relaxed text-paper/70">
                {SITE.tagline}
              </p>

              <Button
                variant="outline-invert"
                href={whatsappUrl(
                  "Hello Standard Furniture — I have a question.",
                )}
                className="mt-6"
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>

              <p className="spec-label mt-4 text-paper/50">
                {WHATSAPP_DISPLAY}
              </p>
            </div>

            {/* Both places. Neither is "the" address. */}
            {LOCATIONS.map((location) => (
              <div key={location.label} className="md:col-span-3">
                <h2 className="spec-label text-brass">{location.label}</h2>
                <p className="spec-label mt-2 text-paper/45 normal-case tracking-normal">
                  {location.role}
                </p>
                <address className="mt-3 not-italic text-paper/80">
                  {location.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              </div>
            ))}

            {/* Hours. */}
            <div className="md:col-span-4 md:col-start-6">
              <h2 className="spec-label text-brass">Hours</h2>
              <div className="mt-3 text-paper/80">
                {HOURS.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </div>
              {!HOURS.confirmed && (
                <p className="spec-label mt-3 text-brass/70">
                  To be confirmed
                </p>
              )}
            </div>
          </div>

          {/* Sitemap and the legal line. */}
          <div className="mt-16 flex flex-col gap-6 border-t border-paper/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <nav aria-label="Footer">
              <ul className="flex flex-wrap gap-x-8 gap-y-3">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="spec-label text-paper/60 transition-colors hover:text-brass focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <p className="spec-label text-paper/40">
              © {year} {SITE.name}, {SITE.town}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
