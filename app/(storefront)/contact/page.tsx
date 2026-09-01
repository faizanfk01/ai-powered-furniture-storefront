import type { Metadata } from "next";

import { ContactBuilder } from "@/components/forms/contact-builder";
import { PageHero } from "@/components/site/page-hero";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  // Interpolated rather than typed out. This description had the number
  // written into it by hand, so it kept the old grouping when the display
  // format changed in lib/site.ts and the page showed two different spellings
  // of one number — the exact drift the constant exists to prevent.
  description: `Standard Furniture, Mardan. Showroom at Shen Gul Plaza, workshop at Sir Anjam Khan Market, Baghdada. Message us on WhatsApp at ${WHATSAPP_DISPLAY}.`,
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
    "Come and sit on the finished pieces, talk through a room, or pick up an order.",
  Workshop:
    "Come and see work in progress, go through a build in detail, or sort out delivery.",
};

export default function ContactPage() {
  return (
    <>
      {/* ------------------------------------------------------------------
          The number, first. Everything else on this page is a way of
          arranging a conversation that this button starts immediately.
         ------------------------------------------------------------------ */}
      <PageHero
        src="/hero/contact_page.jpg"
        alt="A walnut console table in the showroom, its drawer fronts and mitred corner lit by daylight from the window, with a glazed pot and a shallow bowl set on top."
      >
        <p className="text-sm font-medium text-brass">Mardan, Pakistan</p>

        <h1 className="display-wide mt-3 text-3xl leading-[1.08] font-semibold text-paper sm:mt-4 sm:text-4xl md:text-5xl lg:text-6xl">
          Get in touch
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/85 sm:mt-6 sm:text-lg">
          WhatsApp is the quickest way to reach us. It is where prices, photos
          and measurements go back and forth.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4 sm:mt-8">
          <Button
            size="lg"
            variant="solid-invert"
            href={whatsappUrl("Hello Standard Furniture, I have a question.")}
          >
            <WhatsAppIcon />
            Message on WhatsApp
          </Button>

          {/* A tel: link as well as the chat: not everyone uses WhatsApp,
              and on a phone this dials. */}
          <a
            href={`tel:+${WHATSAPP_DISPLAY.replace(/\D/g, "")}`}
            className="tabular text-paper underline decoration-paper/40 underline-offset-4 transition-colors hover:decoration-paper focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
          >
            {WHATSAPP_DISPLAY}
          </a>
        </div>
      </PageHero>

      {/* ------------------------------------------------------------------
          The two addresses, with directions.
         ------------------------------------------------------------------ */}
      <Section
        tone="surface"
        eyebrow="Where we are"
        heading="Two addresses"
        lede="They do different jobs, so it helps to know which one you want before you set off."
      >
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:gap-5">
          {LOCATIONS.map((location) => (
            <li key={location.label}>
              <Card padded className="flex h-full flex-col lg:p-8">
                <h3 className="display-wide text-lg font-semibold sm:text-xl">
                  {location.label}
                </h3>
                <p className="mt-1 text-sm text-muted">{location.role}</p>

                <address className="mt-4 text-base not-italic text-ink sm:text-lg">
                  {location.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>

                {LOCATION_PURPOSE[location.label] && (
                  <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                    {LOCATION_PURPOSE[location.label]}
                  </p>
                )}

                <div className="mt-auto pt-6">
                  <Button variant="outline" href={directionsUrl(location)}>
                    Get directions
                    <span className="sr-only">
                      {" "}
                      to the {location.label.toLowerCase()}. Opens Google Maps.
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
          `HOURS.confirmed` is TRUE now, so the times below are stated as fact
          and the caution panel that used to sit beside them is not rendered.
          That happened on its own when the flag flipped in lib/site.ts — this
          page asks the question rather than hardcoding an answer, which is the
          whole reason the flag exists.

          The block is kept rather than deleted. If the shop changes its hours
          and they need confirming again, flipping the flag back has to bring
          the caution with it; deleting it now would mean the next unconfirmed
          hours are presented as fact.

          THE COLUMN COUNT FOLLOWS THE CAUTION. Two columns exist to pair the
          times with the warning beside them. With no warning there is nothing
          to pair, and a half-width card against an empty column reads as a
          layout that lost something — so the confirmed state is a single card
          at a readable measure instead.
         ------------------------------------------------------------------ */}
      <Section eyebrow="When we are open" heading="Opening hours">
        <div
          className={`grid grid-cols-1 gap-6 ${
            HOURS.confirmed ? "max-w-md" : "lg:grid-cols-2 lg:gap-8"
          }`}
        >
          <Card className="divide-y divide-hairline px-4 sm:px-5 lg:px-6">
            {HOURS.lines.map((line) => (
              <p key={line} className="tabular py-3.5 text-ink">
                {line}
              </p>
            ))}
          </Card>

          {!HOURS.confirmed && (
            <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6 lg:p-8">
              <h3 className="display-wide text-base font-semibold text-accent-strong sm:text-lg">
                Not yet confirmed
              </h3>
              <p className="mt-2 leading-relaxed text-muted">
                We have not confirmed these times yet. Message us before you
                travel and we will tell you exactly when someone will be there.
              </p>
              <Button
                variant="outline"
                className="mt-5"
                href={whatsappUrl(
                  "Hello Standard Furniture, are you open today?",
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
        lede="Write it here and it opens in WhatsApp, ready for you to send. Handy if you want to get the wording right first."
      >
        <ContactBuilder />
      </Section>
    </>
  );
}
