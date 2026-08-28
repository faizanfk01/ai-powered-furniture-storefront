import type { Metadata } from "next";

import { ContactBuilder } from "@/components/forms/contact-builder";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import {
  directionsUrl,
  HOURS,
  LOCATIONS,
  WHATSAPP_DISPLAY,
  whatsappUrl,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Standard Furniture, Mardan. Showroom at Shen Gul Plaza, workshop at Sir Anjam Khan Market, Baghdada. Message us on WhatsApp at +92 300 905 9052.",
};

/**
 * Contact.
 *
 * A Server Component apart from the message builder island. Everything a
 * visitor most needs — the two addresses, directions, the number — is static
 * HTML that renders before any JavaScript arrives, which is the right
 * trade-off for the page somebody opens while standing on a street.
 */

/** What each address is actually for, in the visitor's terms. */
const LOCATION_PURPOSE: Record<string, string> = {
  Showroom:
    "Come to see and sit on finished pieces, talk through a room, or collect an order.",
  Workshop:
    "Come to see work in progress, discuss a build in detail, or arrange delivery.",
};

export default function ContactPage() {
  return (
    <>
      {/* ------------------------------------------------------------------
          The number, first. Everything else on this page is a way of
          arranging a conversation that this button starts immediately.
         ------------------------------------------------------------------ */}
      <section>
        <Container>
          <div className="py-16 sm:py-24">
            <p className="text-sm font-medium text-accent-strong">
              Mardan, Pakistan
            </p>

            <h1 className="display-wide mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl lg:text-6xl">
              Get in touch
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              WhatsApp is the fastest way to reach us — it is where quotes,
              photographs and measurements go back and forth.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Button
                size="lg"
                href={whatsappUrl(
                  "Hello Standard Furniture — I have a question.",
                )}
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>

              {/* A tel: link as well as the chat: not everyone uses WhatsApp,
                  and on a phone this dials. */}
              <a
                href={`tel:+${WHATSAPP_DISPLAY.replace(/\D/g, "")}`}
                className="tabular text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
              >
                {WHATSAPP_DISPLAY}
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------
          The two addresses, with directions.
         ------------------------------------------------------------------ */}
      <Section
        tone="surface"
        eyebrow="Where we are"
        heading="Two addresses"
        lede="They do different jobs — it is worth knowing which one you want before you set off."
      >
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {LOCATIONS.map((location) => (
            <li key={location.label}>
              <Card padded className="flex h-full flex-col sm:p-8">
                <h3 className="display-wide text-xl font-semibold">
                  {location.label}
                </h3>
                <p className="mt-1 text-sm text-muted">{location.role}</p>

                <address className="mt-4 text-lg not-italic text-ink">
                  {location.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>

                {LOCATION_PURPOSE[location.label] && (
                  <p className="mt-3 leading-relaxed text-muted">
                    {LOCATION_PURPOSE[location.label]}
                  </p>
                )}

                <div className="mt-auto pt-6">
                  <Button variant="outline" href={directionsUrl(location)}>
                    Get directions
                    <span className="sr-only">
                      {" "}
                      to the {location.label.toLowerCase()} — opens Google Maps
                    </span>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------
          HOURS.
          `HOURS.confirmed` is false, and this page is the one somebody reads
          before driving across town — so provisional times are labelled as
          provisional and paired with a way to check, rather than presented as
          fact in a slightly smaller font. When the real hours land, the flag
          flips and the caution disappears on its own.

          The caution now sits in a tinted panel beside the times rather than
          under a tracked-out capital label. Same words, and it is harder to
          skim past.
         ------------------------------------------------------------------ */}
      <Section eyebrow="When we are open" heading="Opening hours">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <Card className="divide-y divide-hairline px-5 sm:px-6">
            {HOURS.lines.map((line) => (
              <p key={line} className="tabular py-3.5 text-ink">
                {line}
              </p>
            ))}
          </Card>

          {!HOURS.confirmed && (
            <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
              <h3 className="display-wide text-lg font-semibold text-accent-strong">
                Not yet confirmed
              </h3>
              <p className="mt-2 leading-relaxed text-muted">
                These times are provisional. Message us before you travel and we
                will tell you exactly when someone will be there.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                href={whatsappUrl(
                  "Hello Standard Furniture — are you open today?",
                )}
              >
                <WhatsAppIcon />
                Check today&rsquo;s hours
              </Button>
            </div>
          )}
        </div>
      </Section>

      {/* ------------------------------------------------------------------
          The optional written enquiry.
         ------------------------------------------------------------------ */}
      <Section
        tone="surface"
        eyebrow="Rather write it out?"
        heading="Send us a message"
        lede="Write it here and it opens in WhatsApp, ready to send — useful when you want to get the wording right before you tap."
      >
        <ContactBuilder />
      </Section>
    </>
  );
}
