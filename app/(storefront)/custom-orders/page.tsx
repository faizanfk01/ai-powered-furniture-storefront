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
      <section>
        <Container>
          <div className="py-16 sm:py-24 lg:py-28">
            <p className="text-sm font-medium text-accent-strong">
              Made to your room
            </p>

            <h1 className="display-wide mt-4 max-w-3xl text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl">
              Tell us the room. We will build for it.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
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
        tone="surface"
        eyebrow="What we take on"
        heading="Four kinds of work"
        lede="All four are measured, made and fitted by the same team — which is why they can be quoted together."
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {OFFERINGS.map((offering) => (
            <li key={offering.title}>
              <Card padded className="flex h-full flex-col sm:p-8">
                <h3 className="display-wide text-xl font-semibold">
                  {offering.title}
                </h3>
                <p className="mt-2 leading-relaxed text-ink">
                  {offering.body}
                </p>
                {SERVICE_DETAIL[offering.title] && (
                  <p className="mt-3 leading-relaxed text-muted">
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

      {/* ------------------------------------------------------------------
          The closing handoff, in the tinted panel the other pages close with
          rather than a second dark band above the dark footer.
         ------------------------------------------------------------------ */}
      <Section>
        <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-lg">
              <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                Or come and measure with us
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                For anything built in, bring the room&apos;s measurements to the
                showroom — or ask us to come and take them.
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
                "Hello Standard Furniture — could someone come and measure a room?",
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
