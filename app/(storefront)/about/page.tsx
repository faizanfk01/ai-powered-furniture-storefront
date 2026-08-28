import type { Metadata } from "next";

import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { LOCATIONS, OFFERINGS, SITE, whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Standard Furniture keeps a showroom in Shen Gul Plaza and a workshop in Baghdada, Mardan. One place to see the work, one place where it is made.",
};

/**
 * About — the smallest page, and the one that carries the thesis outright.
 *
 * A NOTE ON THE COPY: everything asserted here comes from the brief — the two
 * addresses and what each is for, the four offerings, and the fact that pieces
 * are built to measure. There is deliberately no founding year, no count of
 * craftsmen, no family history and no awards, because none of that was given
 * and an About page is exactly where an invented detail would sit unnoticed
 * until a customer repeated it back. The "In the owner's words" block is left
 * as a marked gap for real history rather than filled with a plausible story.
 */

/**
 * What made-to-measure actually involves, in order.
 *
 * Numbered because this genuinely is a sequence — you cannot build before you
 * measure, or fit before you build — and the order is the information. A
 * numbered list over content that has no order is decoration; here the numbers
 * are the point, which is why they are the only ornament in this section.
 */
const PROCESS = [
  {
    step: "01",
    title: "Measure",
    body: "The room decides the piece, not the other way round. Wall to wall, how wide the door is, where the light falls, and where people have to walk past.",
  },
  {
    step: "02",
    title: "Draw",
    body: "We agree the sizes and the materials before anything is cut. The same width, depth and height you see printed against every piece in our catalogue.",
  },
  {
    step: "03",
    title: "Build",
    body: "Made in Baghdada by the same people who will bring it to you. Made-to-order pieces usually take three to four weeks.",
  },
  {
    step: "04",
    title: "Fit",
    body: "We bring it and put it where it goes. Wall panelling and wallpaper go up with the same team that brings the furniture.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* ------------------------------------------------------------------
          The thesis, stated plainly — and now on white, like every other page
          on the site. The ink band with the ruler mark and the heading set as
          uppercase signage was the showroom identity's cover treatment; the
          brand dark is spent on the header and the footer.
         ------------------------------------------------------------------ */}
      <section>
        <Container>
          <div className="py-16 sm:py-24 lg:py-28">
            <p className="text-sm font-medium text-accent-strong">
              {SITE.town}, {SITE.region}
            </p>

            <h1 className="display-wide mt-4 max-w-3xl text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl">
              One place to see it. One place where it is made.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Most furniture shops sell you something that arrived on a lorry.
              We keep a showroom on one side of Mardan and the workshop that
              supplies it on the other. The piece you sit on and the piece we
              build for you come from the same hands.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------
          The two places, at equal weight. This is the whole argument, so it
          gets the most room on the page.
         ------------------------------------------------------------------ */}
      <Section
        tone="surface"
        eyebrow="Two addresses"
        heading="Where to find us"
        lede="They do different jobs, so it helps to know which one you want before you set off."
      >
        {/* Real cards with real gaps. `gap-px` on a hairline ground drew a
            two-cell table; these are two places, not two rows of data. */}
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

                <p className="mt-4 leading-relaxed text-muted">
                  {location.label === "Showroom"
                    ? "Sit on it, open the drawers, look at the finish in real light. Bring your room's measurements and we will tell you straight whether a piece will fit."
                    : "This is where the cutting, joinery, upholstery and finishing happen. Customers are welcome. Seeing a piece half-built is the quickest way to understand what you are paying for."}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------
          The process. A real sequence, so it is numbered — and the numbers
          stay the only ornament in this section.
         ------------------------------------------------------------------ */}
      <Section
        eyebrow="How a piece happens"
        heading="Made to measure"
        lede="Every piece in the catalogue can be built to different sizes, in another wood or another fabric. Here is how that works."
      >
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((stage) => (
            <li key={stage.step}>
              <Card padded className="h-full">
                <span className="tabular text-sm font-semibold text-accent-strong">
                  {stage.step}
                </span>
                <h3 className="display-wide mt-2 text-base font-semibold">
                  {stage.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {stage.body}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        tone="surface"
        eyebrow="What we make"
        heading="Four things"
        lede="Furniture is the biggest part of what we do, but a room is rarely just furniture."
      >
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFERINGS.map((offering) => (
            <li key={offering.title}>
              <Card padded className="h-full">
                <h3 className="display-wide text-base font-semibold">
                  {offering.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {offering.body}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------
          Quality, argued through the one thing we can actually prove on a
          website: the catalogue publishes finished sizes.
         ------------------------------------------------------------------ */}
      <Section
        eyebrow="How we work"
        heading="The measurements are the promise"
        width="default"
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="text-lg leading-relaxed text-ink">
              Every piece in our catalogue shows its finished size. Width, depth
              and height, in inches, right there with the piece. Not
              &ldquo;compact&rdquo; or &ldquo;spacious&rdquo;, the actual number.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              It is the dullest thing on the site and the most useful. A sofa
              that will not turn the corner of your stairs is no bargain at any
              price, and the only way to know that in advance is for someone to
              tell you the truth.
            </p>
          </div>

          <div>
            <p className="text-lg leading-relaxed text-ink">
              Solid sheesham, walnut finishes, kiln-dried frames, hand-woven
              rattan, hard-wearing woven fabrics. What a piece is made of is
              written in its description, in the same plain words.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              If something is built to order, the catalogue says so and tells
              you the wait. If it is in the showroom today, it says that
              instead.
            </p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------
          The closing handoff, in the tinted panel the other pages close with
          rather than a second dark band above the dark footer.
         ------------------------------------------------------------------ */}
      <Section>
        <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-lg">
              <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                Tell us about the room
              </h2>
              <p className="mt-2 leading-relaxed text-muted">
                Send us the measurements, or just a photo of the space, and we
                will tell you what we would build for it and what it would cost.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Button
                href={whatsappUrl(
                  "Hello Standard Furniture, I would like to talk about a room.",
                )}
              >
                <WhatsAppIcon />
                Message the workshop
              </Button>
              <Button variant="outline" href="/catalog">
                Browse the catalogue
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
