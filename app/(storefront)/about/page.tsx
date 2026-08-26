import type { Metadata } from "next";

import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
import { Section } from "@/components/ui/section";
import { LOCATIONS, OFFERINGS, SITE, whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Standard Furniture keeps a showroom in Shen Gul Plaza and a workshop in Baghdada, Mardan — one place to see the work, one place where it is made.",
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
    body: "The room decides the piece, not the other way round. Wall to wall, doorway widths, where the light falls and where somebody has to walk past.",
  },
  {
    step: "02",
    title: "Draw",
    body: "Dimensions and materials agreed before anything is cut — the same W × D × H that ends up printed against the piece in our catalogue.",
  },
  {
    step: "03",
    title: "Build",
    body: "Made in Baghdada by the people who will deliver it. Made-to-order pieces typically take three to four weeks.",
  },
  {
    step: "04",
    title: "Fit",
    body: "Delivered and put in place. Wall panelling and wallpaper are fitted by the same team that brings the furniture.",
  },
];

export default function AboutPage() {
  return (
    <>
      {/* ------------------------------------------------------------------
          The thesis, stated plainly.
         ------------------------------------------------------------------ */}
      <section className="bg-ink-deep text-paper">
        <Container>
          <div className="py-20 sm:py-28">
            <Measure />

            <p className="spec-label mt-6 text-brass">
              {SITE.town}, {SITE.region}
            </p>

            <h1 className="display-wide mt-4 max-w-3xl text-4xl leading-[1.05] font-semibold uppercase sm:text-6xl">
              One place to see it.
              <br />
              One place where it is made.
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/75 sm:text-xl">
              Most furniture shops sell you something that arrived on a lorry.
              Standard Furniture keeps a showroom on one side of Mardan and the
              workshop that supplies it on the other — so the piece you sit on
              and the piece we build for you come from the same hands.
            </p>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------
          The two places, at equal weight. This is the whole argument, so it
          gets the most room on the page.
         ------------------------------------------------------------------ */}
      <Section
        eyebrow="Two addresses"
        heading="Where to find us"
        lede="They do different jobs, and it is worth knowing which one you want before you set off."
      >
        <ul className="grid grid-cols-1 gap-px bg-hairline md:grid-cols-2">
          {LOCATIONS.map((location) => (
            <li key={location.label}>
              <Card className="flex h-full flex-col border-0 p-8 sm:p-10">
                <Measure width="w-16" />
                <h3 className="display-wide mt-5 text-2xl font-medium uppercase">
                  {location.label}
                </h3>
                <p className="mt-2 text-muted">{location.role}</p>

                <address className="mt-6 text-lg not-italic text-ink">
                  {location.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>

                <p className="mt-6 leading-relaxed text-muted">
                  {location.label === "Showroom"
                    ? "Sit on it, open the drawers, see the finish under real light. Bring the measurements of your room and we will tell you honestly whether a piece will fit."
                    : "Where the cutting, joinery, upholstery and finishing happen. Customers are welcome — seeing a piece half-built is the fastest way to understand what you are paying for."}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------------------
          The process. A real sequence, so it is numbered.
         ------------------------------------------------------------------ */}
      <Section
        tone="ink"
        eyebrow="How a piece happens"
        heading="Made to measure, literally"
        lede="Every piece in the catalogue can be rebuilt to different dimensions, in a different wood or a different fabric. This is what that involves."
      >
        <ol className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS.map((stage) => (
            <li key={stage.step} className="border-t border-paper/20 pt-6">
              <span className="spec-label text-brass">{stage.step}</span>
              <h3 className="display-wide mt-3 text-xl font-medium uppercase">
                {stage.title}
              </h3>
              <p className="mt-3 leading-relaxed text-paper/70">{stage.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="What we make"
        heading="Four things"
        lede="Furniture is the largest part of it, but a room is rarely only furniture."
      >
        <ul className="grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
          {OFFERINGS.map((offering) => (
            <li key={offering.title}>
              <Card className="h-full border-0 p-8">
                <h3 className="display-wide text-lg font-medium">
                  {offering.title}
                </h3>
                <p className="mt-3 leading-relaxed text-muted">
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
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-lg leading-relaxed text-ink">
              Every piece in our catalogue is published at its finished size —
              width, depth and height, in inches, against the piece itself. Not
              &ldquo;compact&rdquo; or &ldquo;spacious&rdquo;: the number.
            </p>
            <p className="mt-5 leading-relaxed text-muted">
              It is the least glamorous thing on the site and the most useful.
              A sofa that will not turn the corner of your stairs is not a
              bargain at any price, and the only way to know before it arrives
              is to have been told the truth about it beforehand.
            </p>
          </div>

          <div>
            <p className="text-lg leading-relaxed text-ink">
              Solid sheesham, walnut finishes, kiln-dried frames, hand-woven
              rattan, hard-wearing woven fabrics — what a piece is made of is
              written in its description, in the same plain terms.
            </p>
            <p className="mt-5 leading-relaxed text-muted">
              If something is built to order, the catalogue says so and gives
              the wait. If it is in the showroom today, it says that instead.
            </p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section tone="ink">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <Measure />
            <h2 className="display-wide mt-6 text-3xl font-semibold uppercase sm:text-4xl">
              Tell us about the room
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-paper/75">
              Send the measurements, or a photograph of the space, and we will
              tell you what we would build for it and what it would cost.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="solid-invert"
              href={whatsappUrl(
                "Hello Standard Furniture — I would like to talk about a room.",
              )}
            >
              <WhatsAppIcon />
              Message the workshop
            </Button>
            <Button variant="outline-invert" href="/catalog">
              Browse the catalogue
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
