import type { Metadata } from "next";

import { PageHero } from "@/components/site/page-hero";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
          The thesis, stated plainly, over the one photograph that argues it
          without a caption: a finished sideboard in the foreground and the
          bench it came off behind. Same darkened-photograph hero as the other
          three pages — see components/site/page-hero.tsx for the overlay and
          why it is one component rather than four agreeing.
         ------------------------------------------------------------------ */}
      <PageHero
        src="/hero/about_page.jpg"
        alt="A finished walnut sideboard dressed with a lamp and two bowls in the foreground, and behind it the workshop it came from, with rough-sawn boards stacked on a trestle."
        // Biased low. Centred, the band's wide crop keeps the dark upper wall
        // and loses the sideboard entirely — which is half the argument this
        // page makes, and half of what the alt text promises.
        position="object-[50%_72%]"
      >
        <p className="text-sm font-medium text-brass">
          {SITE.town}, {SITE.region}
        </p>

        <h1 className="display-wide mt-3 max-w-3xl text-3xl leading-[1.08] font-semibold text-paper text-balance sm:mt-4 sm:text-4xl md:text-5xl lg:text-6xl 2xl:max-w-4xl">
          One place to see it. One place where it is made.
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-paper/85 sm:mt-6 sm:text-lg">
          Most furniture shops sell you something that arrived on a lorry. We
          keep a showroom on one side of Mardan and the workshop that supplies
          it on the other. The piece you sit on and the piece we build for you
          come from the same hands.
        </p>
      </PageHero>

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

                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
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
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5">
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
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5">
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
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <p className="text-base leading-relaxed text-ink sm:text-lg">
              Every piece in our catalogue shows its finished size. Width, depth
              and height, in inches, right there with the piece. Not
              &ldquo;compact&rdquo; or &ldquo;spacious&rdquo;, the actual
              number.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              It is the dullest thing on the site and the most useful. A sofa
              that will not turn the corner of your stairs is no bargain at any
              price, and the only way to know that in advance is for someone to
              tell you the truth.
            </p>
          </div>

          <div>
            <p className="text-base leading-relaxed text-ink sm:text-lg">
              Solid sheesham, walnut finishes, kiln-dried frames, hand-woven
              rattan, hard-wearing woven fabrics. What a piece is made of is
              written in its description, in the same plain words.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
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
        <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-lg">
              <h2 className="display-wide text-lg font-semibold sm:text-xl lg:text-2xl">
                Tell us about the room
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
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
