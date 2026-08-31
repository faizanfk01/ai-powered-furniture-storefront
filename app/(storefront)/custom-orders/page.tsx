import type { Metadata } from "next";

import { CustomOrderBuilder } from "@/components/forms/custom-order-builder";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LOCATIONS, OFFERINGS, whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Custom Orders",
  description:
    "Custom furniture, interior design, 3D wallpapers and PVC panels, built to your measurements in Baghdada, Mardan. Tell us about the room and we will give you a price.",
};

/**
 * Custom Orders — the showcase, then the handoff.
 *
 * A Server Component: the four services and the copy around them are static,
 * and only the message builder needs state. That island is the sole client
 * component on the page.
 */

/**
 * What each service actually involves, beyond the one-line description that
 * OFFERINGS carries for the home and About pages.
 *
 * Keyed by title rather than duplicating the list, so adding a fifth offering
 * to lib/site.ts shows up here immediately — with no detail line until someone
 * writes one, which is the correct failure: a missing paragraph, not a missing
 * service.
 */
const SERVICE_DETAIL: Record<string, string> = {
  "Custom furniture":
    "Any piece in the catalogue built to different measurements, or something that has never been in it. Another wood, another fabric, a wardrobe that follows a sloped ceiling.",
  "Interior design":
    "Planning a whole room instead of just picking things for it. What goes where, what it is made of, and what it costs, all before anything is ordered.",
  "3D wallpapers":
    "Textured panels and printed murals, measured to your wall and put up by the team that brings the furniture.",
  "PVC panels":
    "Wall and ceiling panelling for rooms that take a lot of wear. Kitchens, corridors, shopfronts and clinics.",
};

export default function CustomOrdersPage() {
  return (
    <>
      <section>
        <Container>
          <div className="py-12 sm:py-20 lg:py-24 xl:py-28">
            <p className="text-sm font-medium text-accent-strong">
              Made to your room
            </p>

            <h1 className="display-wide mt-3 max-w-3xl text-3xl leading-[1.08] font-semibold text-balance sm:mt-4 sm:text-4xl md:text-5xl lg:text-6xl 2xl:max-w-4xl">
              Tell us the room. We will build for it.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              Everything in our catalogue can be built to different
              measurements, and plenty of what we make never appears there at
              all. Tell us what you need and we will tell you what it would
              take.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------
          The four services, in more depth than the home page gives them.
         ------------------------------------------------------------------ */}
      <Section
        tone="surface"
        eyebrow="What we take on"
        heading="Four kinds of work"
        lede="The same team measures, makes and fits all four, so we can price them together."
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5">
          {OFFERINGS.map((offering) => (
            <li key={offering.title}>
              <Card padded className="flex h-full flex-col lg:p-8">
                <h3 className="display-wide text-lg font-semibold sm:text-xl">
                  {offering.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink sm:text-base">
                  {offering.body}
                </p>
                {SERVICE_DETAIL[offering.title] && (
                  <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                    {SERVICE_DETAIL[offering.title]}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------
          The builder.
         ------------------------------------------------------------------ */}
      <Section
        eyebrow="Start the conversation"
        heading="Write us a message"
        lede="Fill in what you know. Your message appears on the right, and opens in WhatsApp when you are ready."
      >
        <CustomOrderBuilder />
      </Section>

      {/* ------------------------------------------------------------------
          The closing handoff, in the tinted panel the other pages close with
          rather than a second dark band above the dark footer.
         ------------------------------------------------------------------ */}
      <Section>
        <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-lg">
              <h2 className="display-wide text-lg font-semibold sm:text-xl lg:text-2xl">
                Or come and measure with us
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                For anything built in, bring the room&apos;s measurements to the
                showroom, or ask us to come and take them.
              </p>
              <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {LOCATIONS.map((location) => (
                  <div key={location.label}>
                    <dt className="text-sm font-semibold text-ink">
                      {location.label}
                    </dt>
                    <dd className="mt-1 text-sm text-muted">
                      {location.lines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <Button
              href={whatsappUrl(
                "Hello Standard Furniture, could someone come and measure a room?",
              )}
              className="shrink-0"
            >
              <WhatsAppIcon />
              Ask for a visit
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
