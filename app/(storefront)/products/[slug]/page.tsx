import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiSummary } from "@/components/product/ai-summary";
import { ReviewForm } from "@/components/reviews/review-form";
import { AskAiButton } from "@/components/product/ask-ai-button";
import { ProductGallery } from "@/components/product/product-gallery";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { db } from "@/lib/db";
import { parseFootprint } from "@/lib/footprint";
import { formatPrice, STOCK_LABEL } from "@/lib/format";
import { productInclude } from "@/lib/products";
import { whatsappUrl } from "@/lib/site";
import { absoluteUrl, productPath } from "@/lib/url";

/**
 * The product page — the conversion page.
 *
 * Direct DB read by slug, per the phase's data decision. The slug is the URL
 * key rather than the id because it is the thing a person sees and a search
 * engine indexes; it is unique in the schema, so it addresses exactly one row.
 */

async function getProduct(slug: string) {
  return db.product.findUnique({
    where: { slug },
    include: productInclude,
  });
}

export async function generateMetadata({
  params,
}: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: "Piece not found" };

  return {
    title: product.name,
    // The AI summary when it exists, the real description otherwise — never a
    // template string, which is what search results would otherwise all be.
    description: (product.aiSummary ?? product.description).slice(0, 155),
    alternates: { canonical: productPath(product.slug) },
    openGraph: {
      title: `${product.name} · Standard Furniture`,
      description: (product.aiSummary ?? product.description).slice(0, 200),
      images: product.images[0] ? [{ url: product.images[0].url }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) notFound();

  const footprint = parseFootprint(product.dimensions);
  const price = formatPrice(product.price);

  // The prefill the brief specifies, with an absolute link — the message lands
  // in a chat app where a relative path means nothing, and the shop needs to
  // open the exact piece being asked about.
  const url = await absoluteUrl(productPath(product.slug));
  const enquiry = whatsappUrl(
    `Hello, I am interested in purchasing ${product.name} listed at ${price}. Here is the link: ${url}`,
  );

  const madeToOrder = product.stockStatus === "MADE_TO_ORDER";

  const outOfStock = product.stockStatus === "OUT_OF_STOCK";

  // The same three tones the catalogue card uses, so a piece does not change
  // its availability language between the grid and its own page.
  const stockTone = madeToOrder
    ? "bg-accent-soft text-accent-strong"
    : outOfStock
      ? "bg-surface text-muted"
      : "bg-surface text-ink";

  return (
    // The DEFAULT measure, deliberately, even though this page is a two-column
    // layout that could take `wide`. The right-hand column is a price, a button
    // and a five-row spec table; the below-the-fold columns are prose. Half of
    // the catalogue's 108rem frame is an 800px line of body copy, which is
    // unreadable however much monitor there is. The default frame grows too —
    // 72rem to 96rem across the ramp — and that is the right amount here.
    <Container>
      <div className="py-6 sm:py-8 lg:py-12">
        {/* Back to where they came from. A product page reached from a filtered
            catalogue loses the filter; that is the price of not tracking
            history here, and a plain link back is honest about it. */}
        <Link
          href="/catalog"
          className="text-sm text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
        >
          ← Catalogue
        </Link>

        <div className="mt-5 grid grid-cols-1 gap-8 sm:mt-6 lg:grid-cols-2 lg:gap-12 xl:gap-14">
          <ProductGallery product={product} />

          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-4">
              <Link
                href={`/catalog?category=${product.category.slug}`}
                className="text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
              >
                {product.category.name}
              </Link>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${stockTone}`}
              >
                {STOCK_LABEL[product.stockStatus]}
              </span>
            </div>

            <h1 className="display-wide mt-3 text-2xl leading-tight font-semibold text-balance sm:text-3xl lg:text-4xl">
              {product.name}
            </h1>

            {/* `tabular` rather than the old mono face: the price is compared
                against other prices, which is what tabular figures are for. */}
            <p className="tabular mt-3 text-2xl font-semibold text-ink sm:mt-4 sm:text-3xl">
              {price}
            </p>

            {madeToOrder && (
              <p className="mt-2 text-sm text-muted">
                Built to order. It takes three to four weeks.
              </p>
            )}

            {/* THE conversion action. First thing under the price, and the only
                solid button on the page. */}
            <div className="mt-6 sm:mt-7">
              <Button size="lg" href={enquiry} className="w-full sm:w-auto">
                <WhatsAppIcon />
                Ask us on WhatsApp
              </Button>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Opens a chat with the workshop. This piece and its price are
                already written in for you.
              </p>
            </div>

            <div className="mt-6">
              <AskAiButton productName={product.name} />
            </div>

            {/* Specifications. A card with hairline-divided rows — the same
                object the rest of the site builds panels from, rather than a
                bare table ruled top and bottom. */}
            <Card className="mt-7 divide-y divide-hairline px-4 sm:mt-8 sm:px-5">
              <SpecRow label="Price" value={price} />
              <SpecRow label="Category" value={product.category.name} />
              <SpecRow
                label="Availability"
                value={STOCK_LABEL[product.stockStatus]}
              />
              <SpecRow
                label="Dimensions"
                value={product.dimensions ?? "Ask the workshop"}
              />
              {footprint && (
                <SpecRow
                  label="Floor area"
                  value={`${footprint.width}" × ${footprint.depth}"`}
                />
              )}
            </Card>
          </div>
        </div>

        {/* Below the fold: the two accounts of the piece — the short one a
            machine wrote, and the long one the workshop wrote. Side by side and
            on different grounds, so which is which is legible before either is
            read. */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:mt-14 sm:gap-8 lg:mt-20 lg:grid-cols-2 lg:gap-12">
          <AiSummary summary={product.aiSummary} />

          {/* Top padding matched to the panel beside it, so the two headings
              start on the same line. No horizontal padding: this column is
              flush with the grid, which is what keeps the tinted panel reading
              as the inset one of the pair. */}
          <section
            aria-labelledby="description-heading"
            className="pt-6 sm:pt-8"
          >
            <h2
              id="description-heading"
              className="display-wide text-lg font-semibold sm:text-xl"
            >
              About this piece
            </h2>
            <p className="mt-3 leading-relaxed whitespace-pre-line text-muted">
              {product.description}
            </p>
          </section>
        </div>

        {/* The made-to-measure CTA, in the same tinted panel the catalogue
            closes its grid with. */}
        <div className="mt-10 rounded-xl border border-hairline bg-surface p-5 sm:mt-14 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                Want it in another size?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                We can build this to your measurements, in another fabric or
                another wood. Tell us about the room and we will give you a
                price.
              </p>
            </div>
            <Button
              variant="outline"
              href={whatsappUrl(
                `Hello Standard Furniture, could you build the ${product.name} to different measurements?`,
              )}
              className="shrink-0"
            >
              <WhatsAppIcon />
              Ask about a custom size
            </Button>
          </div>
        </div>

        {/* REVIEWS — the form only, and last on the page.

            Here because this is where a product review can be attributed
            correctly: the customer is looking at the piece, so `productId` is
            known rather than guessed at. Last because everything above it is
            for someone deciding, and this is for someone who already decided
            and came back — putting it higher would sit a form for past
            customers in front of the WhatsApp CTA for future ones.

            NOTE: approved reviews are not shown on this page yet. They surface
            on the home page, attributed and linked back here. Rendering them
            per product is a display feature, not part of wiring the form. */}
        <div className="mt-10 max-w-2xl sm:mt-14">
          <ReviewForm productId={product.id} productName={product.name} />
        </div>
      </div>
    </Container>
  );
}

/** One line of the spec table. Label left, value right. */
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular text-right text-sm font-medium text-ink">
        {value}
      </dd>
    </div>
  );
}
