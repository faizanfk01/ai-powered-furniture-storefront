import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
import { Section } from "@/components/ui/section";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { LOCATIONS, SITE, whatsappUrl } from "@/lib/site";

/**
 * PLACEHOLDER HOME PAGE.
 *
 * Phase 4a step 2 owns the layout and the primitives, not the home page — the
 * real one comes in a later sub-phase with photography and featured pieces.
 * This exists because the alternative was leaving create-next-app's starter
 * page under the new header, and because the layout cannot be reviewed against
 * nothing.
 *
 * It is built only from the primitives, on purpose: if the shared components
 * cannot carry a page this simple, they are the wrong components.
 */

const OFFERINGS = [
  {
    title: "Custom furniture",
    body: "Sofas, beds, dining and office pieces built to your room's measurements in our own workshop.",
  },
  {
    title: "Interior design",
    body: "Room-by-room planning — layout, materials and finishes chosen against the space you actually have.",
  },
  {
    title: "3D wallpapers",
    body: "Textured wall panels and printed murals, fitted by the same team that installs the furniture.",
  },
  {
    title: "PVC panels",
    body: "Hard-wearing wall and ceiling panelling for rooms that need to take daily use.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero. The approved thesis: a workshop that keeps a showroom, in a
          specific town — so the two addresses are the closing statement rather
          than a detail in the footer. */}
      <section className="bg-ink-deep text-paper">
        <Container>
          <div className="py-20 sm:py-28">
            <Measure />

            <p className="spec-label mt-6 text-brass">
              {SITE.town}, {SITE.region}
            </p>

            <h1 className="display-wide mt-5 text-5xl leading-[0.95] font-semibold uppercase sm:text-7xl lg:text-8xl">
              Standard
              <br />
              Furniture
            </h1>

            <p className="mt-8 max-w-xl text-lg leading-relaxed text-paper/75 sm:text-xl">
              Custom furniture, interior design, 3D wallpapers and PVC panels.
              Drawn to your room&apos;s measurements, built in Baghdada, shown
              in Shen Gul Plaza.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button variant="solid-invert" href="/catalog">
                Browse the catalogue
              </Button>
              <Button
                variant="outline-invert"
                href={whatsappUrl(
                  "Hello Standard Furniture — I have a question.",
                )}
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>
            </div>

            <dl className="mt-16 grid max-w-2xl grid-cols-1 gap-8 border-t border-paper/15 pt-8 sm:grid-cols-2">
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
        </Container>
      </section>

      <Section
        eyebrow="What we make"
        heading="Four things, done properly"
        lede="Everything is measured, built and fitted by the same team — the showroom and the workshop are eight minutes apart."
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
    </>
  );
}
