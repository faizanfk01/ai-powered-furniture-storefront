import type { Metadata } from "next";

import { CustomOrderBuilder } from "@/components/forms/custom-order-builder";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
import { Section } from "@/components/ui/section";
import { LOCATIONS, OFFERINGS, whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Custom Orders",
  description:
    "Custom furniture, interior design, 3D wallpapers and PVC panels, built to your measurements in Baghdada, Mardan. Tell us about the room and we will quote it.",
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
    "Any piece in the catalogue rebuilt to different measurements, or something that has never been in it. Different wood, different fabric, a wardrobe that follows a sloped ceiling.",
  "Interior design":
    "Planning a whole room rather than choosing objects for it: what goes where, what it is made of, and what it costs before anything is ordered.",
  "3D wallpapers":
    "Textured panels and printed murals, measured to the wall and fitted by the team that delivers the furniture.",
  "PVC panels":
    "Wall and ceiling panelling for rooms that take daily wear — kitchens, corridors, shopfronts and clinics.",
};

export default function CustomOrdersPage() {
  return (
    <>
      <section className="bg-ink-deep text-paper">
        <Container>
          <div className="py-20 sm:py-28">
            <Measure />

            <p className="spec-label mt-6 text-brass">Made to your room</p>

            <h1 className="display-wide mt-4 max-w-3xl text-4xl leading-[1.05] font-semibold uppercase sm:text-6xl">
              Tell us the room.
              <br />
              We will build for it.
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/75 sm:text-xl">
              Everything in our catalogue can be rebuilt to different
              measurements — and plenty of what we make never appears there at
              all. Describe what you need and we will tell you what it would
              take.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------
          The four services, in more depth than the home page gives them.
         ------------------------------------------------------------------ */}
      <Section
        eyebrow="What we take on"
        heading="Four kinds of work"
        lede="All four are measured, made and fitted by the same team — which is why they can be quoted together."
      >
        <ul className="grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
          {OFFERINGS.map((offering) => (
            <li key={offering.title}>
              <Card className="flex h-full flex-col border-0 p-8 sm:p-10">
                <Measure width="w-16" />
                <h3 className="display-wide mt-5 text-xl font-medium uppercase">
                  {offering.title}
                </h3>
                <p className="mt-3 leading-relaxed text-ink">
                  {offering.body}
                </p>
                {SERVICE_DETAIL[offering.title] && (
                  <p className="mt-4 leading-relaxed text-muted">
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
        lede="Fill in what you know. The message builds itself on the right, and opens in WhatsApp when you are ready."
      >
        <CustomOrderBuilder />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section tone="ink">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <Measure />
            <h2 className="display-wide mt-6 text-2xl font-semibold uppercase sm:text-3xl">
              Or come and measure with us
            </h2>
            <p className="mt-4 leading-relaxed text-paper/75">
              For anything built in, bring the room&apos;s measurements to the
              showroom — or ask us to come and take them.
            </p>
            <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {LOCATIONS.map((location) => (
                <div key={location.label}>
                  <dt className="spec-label text-brass">{location.label}</dt>
                  <dd className="mt-2 text-paper/80">
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
            variant="solid-invert"
            href={whatsappUrl(
              "Hello Standard Furniture — could someone come and measure a room?",
            )}
          >
            <WhatsAppIcon />
            Ask for a visit
          </Button>
        </div>
      </Section>
    </>
  );
}
