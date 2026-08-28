import Link from "next/link";
import { connection } from "next/server";

import { ProductCard } from "@/components/catalog/product-card";
import { ReviewForm } from "@/components/reviews/review-form";
import {
  Testimonial,
  type TestimonialReview,
} from "@/components/home/testimonial";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
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
          named town.

          ON WHITE NOW. It was a full ink band opening with the ruler mark and
          the name set as signage at 8xl uppercase — an editorial cover, which
          is what the showroom identity wanted. A storefront opens on its own
          page ground and leads with what it sells; the brand dark is spent on
          the header and the footer, which is where a customer looks for it.

          The headline is the second half of the old lede, promoted. No new
          claim is made here: the workshop-and-showroom pair was already the
          hero's copy, it was just sitting underneath a wordmark.
         ------------------------------------------------------------------ */}
      <section>
        <Container>
          <div className="py-16 sm:py-24 lg:py-28">
            <p className="text-sm font-medium text-accent-strong">
              {SITE.town}, {SITE.region}
            </p>

            <h1 className="display-wide mt-4 max-w-3xl text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl">
              We build it in Baghdada. You see it in Shen Gul Plaza.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Custom furniture, interior design, 3D wallpapers and PVC panels,
              measured for your room by the same people who build it.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" href="/catalog">
                Browse the catalogue
              </Button>
              <Button
                size="lg"
                variant="outline"
                href={whatsappUrl(
                  "Hello Standard Furniture, I have a question.",
                )}
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>
            </div>
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------------------------
          THE TWO ADDRESSES — kept directly under the hero, because the pair IS
          the proposition: you can see the work, and you can see where it is
          made. That decision is unchanged; only the treatment is. It was a
          bordered <dl> inside the ink band, and is now the page's first quiet
          band, which separates it from the hero without another dark stripe.
         ------------------------------------------------------------------ */}
      <section className="border-y border-hairline bg-surface">
        <Container>
          <dl className="grid grid-cols-1 gap-8 py-10 sm:grid-cols-2 sm:gap-12">
            {LOCATIONS.map((location) => (
              <div key={location.label}>
                <dt className="text-sm font-semibold text-ink">
                  {location.label}
                </dt>
                <dd className="mt-1">
                  <span className="block text-sm text-muted">
                    {location.role}
                  </span>
                  <address className="mt-2 text-ink not-italic">
                    {location.lines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="What we make"
        heading="Four things we do well"
        lede="The same team measures, builds and fits all of it. The showroom and the workshop are a few minutes apart."
      >
        {/* Real cards with real gaps. The `gap-px` on a hairline ground this
            replaces drew a ruled table, which is a way of presenting data, not
            a way of presenting four things you can buy. */}
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
          FEATURED — the self-curating breadth selection from getFeatured()
          above, untouched. On the quiet band so the white product cards read
          as objects sitting on the page rather than as regions of it.
         ------------------------------------------------------------------ */}
      {featured.length > 0 && (
        <Section
          tone="surface"
          width="wide"
          eyebrow="A piece from each room"
          heading="From the catalogue"
          lede="One piece from every category we build. Each one is listed at its finished size, and we can build it to yours."
        >
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>

          <div className="mt-10">
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

          The layout still adapts to how much evidence there actually is: a
          single approved review becomes one large pull quote, several become a
          grid. What is gone is the ink band with a white panel inset into it —
          a card floating in a dark frame, which put a border around the
          evidence and made it look staged.
         ------------------------------------------------------------------ */}
      {testimonials.length > 0 && (
        <Section eyebrow="In their words" heading="What people tell us">
          {testimonials.length === 1 ? (
            <div className="max-w-3xl">
              <Testimonial review={testimonials[0]!} featured />
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((review) => (
                <li key={review.id}>
                  <Testimonial review={review} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------------------
          LEAVE A REVIEW — a general store review, so productId is null.

          OUTSIDE the testimonials block above on purpose. That section is not
          rendered at all when nothing has been approved yet, and a review form
          that disappears exactly while there are no reviews is a form that can
          never collect the first one. This one is always here.

          Kept to its own quiet band rather than folded into the section above:
          the testimonials are evidence being presented, this is a request
          being made of the reader, and running them together would make the
          evidence look solicited.
         ------------------------------------------------------------------ */}
      <Section tone="surface" width="narrow">
        <ReviewForm />
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        eyebrow="Come and see it"
        heading="Two addresses, eight minutes apart"
        lede="Sit on the sofa before you buy it, then go and watch the next one being built. Most customers do both in the same afternoon."
      >
        <Card padded className="sm:p-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-12">
              {LOCATIONS.map((location) => (
                <div key={location.label}>
                  <dt className="text-sm font-semibold text-ink">
                    {location.label}
                  </dt>
                  <dd className="mt-1.5 text-sm text-muted">
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
                "Hello Standard Furniture, I would like to visit the showroom.",
              )}
              className="shrink-0"
            >
              <WhatsAppIcon />
              Message the showroom
            </Button>
          </div>
        </Card>

        <p className="mt-6 text-sm text-muted">
          Planning something bigger?{" "}
          <Link
            href="/catalog"
            className="underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink"
          >
            Browse the catalogue
          </Link>{" "}
          to see what we build, then tell us about your room.
        </p>
      </Section>
    </>
  );
}
