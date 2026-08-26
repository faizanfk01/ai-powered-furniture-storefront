import Link from "next/link";
import { connection } from "next/server";

import { ProductCard } from "@/components/catalog/product-card";
import {
  Testimonial,
  type TestimonialReview,
} from "@/components/home/testimonial";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
import { Section } from "@/components/ui/section";
import { db } from "@/lib/db";
import { productInclude } from "@/lib/products";
import { LOCATIONS, OFFERINGS, SITE, whatsappUrl } from "@/lib/site";

/**
 * FEATURED SELECTION — there is no `featured` flag in the schema, so the page
 * has to choose, and the choice should answer the question a home page is for.
 *
 * Rejected: by price, which would show only the most expensive things we make
 * and misrepresent a shop whose catalogue starts at Rs 18,500. By newest,
 * which shows whatever the last import happened to contain — an artefact of
 * data entry, not an editorial decision.
 *
 * Chosen: BREADTH. One piece from each category, so a first-time visitor sees
 * at a glance that we make sofas AND beds AND tables AND chairs AND office
 * sets. That is the actual question someone arriving at a furniture shop's
 * home page is asking.
 *
 * Out-of-stock pieces are excluded — featuring something you cannot buy is a
 * wasted slot — and within a category the most recently added wins, so adding
 * a new sofa refreshes the home page without anyone editing it.
 *
 * One query with a nested take, rather than fetching the catalogue and
 * grouping in memory: bounded by the number of categories, whatever the
 * catalogue grows to.
 */
async function getFeatured() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      products: {
        where: { stockStatus: { not: "OUT_OF_STOCK" } },
        include: productInclude,
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return categories.flatMap((category) => category.products);
}

/**
 * Approved reviews only — PENDING text has not been read by anyone at the shop
 * and must never reach the storefront.
 *
 * Store-level reviews (productId null) come first because they are about the
 * business itself, which is what a home page is introducing. Product reviews
 * follow, keeping their attribution: "on the Karachi 3-Seater Fabric Sofa" is
 * stronger evidence than an unattached compliment, and it links a persuaded
 * reader straight to the piece that persuaded them.
 */
async function getTestimonials(): Promise<TestimonialReview[]> {
  const reviews = await db.review.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      authorName: true,
      rating: true,
      body: true,
      productId: true,
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  return [
    ...reviews.filter((review) => review.productId === null),
    ...reviews.filter((review) => review.productId !== null),
  ];
}

export default async function HomePage() {
  // Nothing on this page reads cookies, headers or searchParams, so without
  // this Next prerenders it at build time — and the featured pieces and
  // testimonials would freeze at whatever the database held when the site was
  // deployed. Adding a product or approving a review has to change the home
  // page without a rebuild.
  //
  // The cost is rendering per request. When this catalogue is large enough for
  // that to matter, the fix is a cached render with revalidation, not going
  // back to a build-time snapshot.
  await connection();

  // Independent queries, so they overlap rather than queue.
  const [featured, testimonials] = await Promise.all([
    getFeatured(),
    getTestimonials(),
  ]);

  return (
    <>
      {/* ------------------------------------------------------------------
          HERO — the approved thesis. A workshop that keeps a showroom, in a
          named town. The two addresses are the closing statement, not a
          detail buried in the footer, because the pair IS the proposition:
          you can see the work, and you can see where it is made.
         ------------------------------------------------------------------ */}
      <section className="bg-ink-deep text-paper">
        <Container>
          <div className="py-20 sm:py-28 lg:py-32">
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
                    <span className="mb-1 block text-sm text-paper/50">
                      {location.role}
                    </span>
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

      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="What we make"
        heading="Four things, done properly"
        lede="Everything is measured, built and fitted by the same team — the showroom and the workshop are a few minutes apart."
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

      {/* ------------------------------------------------------------------ */}
      {featured.length > 0 && (
        <Section
          eyebrow="A piece from each room"
          heading="From the catalogue"
          lede="One from every category we build. Each is listed at its finished size, and each can be rebuilt to yours."
        >
          <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>

          <div className="mt-14 border-t border-hairline pt-8">
            <Button variant="outline" href="/catalog">
              See the full catalogue
            </Button>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------------
          TESTIMONIALS — real approved reviews, never PENDING.

          EMPTY STATE: the section is not rendered at all when nothing is
          approved. A "what our customers say" heading over a placeholder is
          worse than silence — it advertises that nobody has said anything.
          There is nothing for a visitor to act on here either, so an empty
          panel would be decoration standing in for evidence.

          The layout adapts to how much evidence there actually is: a single
          approved review becomes one large pull quote, which reads as an
          editorial choice; several become a grid.
         ------------------------------------------------------------------ */}
      {testimonials.length > 0 && (
        <section className="bg-ink-deep py-20 text-paper sm:py-28">
          <Container>
            <Measure />
            <p className="spec-label mt-6 text-brass">In their words</p>
            <h2 className="display-wide mt-4 text-3xl font-semibold uppercase sm:text-4xl">
              From the showroom floor
            </h2>

            <div className="mt-12 rounded-none bg-paper p-8 text-ink sm:p-12">
              {testimonials.length === 1 ? (
                <div className="max-w-3xl">
                  <Testimonial review={testimonials[0]!} featured />
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
                  {testimonials.map((review) => (
                    <li key={review.id}>
                      <Testimonial review={review} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Container>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="Come and see it"
        heading="Two addresses, eight minutes apart"
        lede="Sit on the sofa before you buy it, then watch the next one being built. Most customers do both in the same afternoon."
      >
        <div className="flex flex-col gap-8 border-t border-hairline pt-8 sm:flex-row sm:items-end sm:justify-between">
          <dl className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-16">
            {LOCATIONS.map((location) => (
              <div key={location.label}>
                <dt className="spec-label text-muted">{location.label}</dt>
                <dd className="mt-2 text-ink">
                  {location.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>

          <Button
            href={whatsappUrl(
              "Hello Standard Furniture — I would like to visit the showroom.",
            )}
          >
            <WhatsAppIcon />
            Message the showroom
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted">
          Planning something bigger?{" "}
          <Link
            href="/catalog"
            className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
          >
            Browse the catalogue
          </Link>{" "}
          to see what we build, then tell us the room.
        </p>
      </Section>
    </>
  );
}
