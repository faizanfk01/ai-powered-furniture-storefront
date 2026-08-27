import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AiSummary } from "@/components/product/ai-summary";
import { ReviewForm } from "@/components/reviews/review-form";
import { AskAiButton } from "@/components/product/ask-ai-button";
import { ProductGallery } from "@/components/product/product-gallery";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
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

  return (
    <Container>
      <div className="py-10 sm:py-14">
        {/* Back to where they came from. A product page reached from a filtered
            catalogue loses the filter; that is the price of not tracking
            history here, and a plain link back is honest about it. */}
        <Link
          href="/catalog"
          className="spec-label text-muted transition-colors hover:text-ink"
        >
          ← Catalogue
        </Link>

        <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <ProductGallery product={product} />

          <div className="flex flex-col">
            <Measure />

            <div className="mt-6 flex items-baseline justify-between gap-4">
              <Link
                href={`/catalog?category=${product.category.slug}`}
                className="spec-label text-muted transition-colors hover:text-ink"
              >
                {product.category.name}
              </Link>
              <span
                className={`spec-label ${
                  madeToOrder
                    ? "text-brass"
                    : product.stockStatus === "OUT_OF_STOCK"
                      ? "text-muted/60"
                      : "text-muted"
                }`}
              >
                {STOCK_LABEL[product.stockStatus]}
              </span>
            </div>

            <h1 className="display-wide mt-4 text-3xl leading-tight font-semibold uppercase sm:text-4xl">
              {product.name}
            </h1>

            <p className="mt-5 font-mono text-2xl text-ink">{price}</p>

            {madeToOrder && (
              <p className="mt-2 text-sm text-muted">
                Built to order — allow three to four weeks.
              </p>
            )}

            {/* THE conversion action. First thing under the price, biggest
                thing in the column, and the only solid button on the page. */}
            <div className="mt-8">
              <Button href={enquiry} className="w-full sm:w-auto">
                <WhatsAppIcon />
                Enquire on WhatsApp
              </Button>
              <p className="mt-2 text-sm text-muted">
                Opens a chat with the workshop, with this piece and its price
                already written in.
              </p>
            </div>

            <div className="mt-8">
              <AskAiButton productName={product.name} />
            </div>

            {/* Specifications. The mono voice, because these are the numbers
                you compare between pieces. */}
            <dl className="mt-10 border-t border-hairline">
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
            </dl>
          </div>
        </div>

        {/* Below the fold: the two accounts of the piece — the short one a
            machine will write, and the long one the workshop wrote. */}
        <div className="mt-16 grid grid-cols-1 gap-12 lg:mt-24 lg:grid-cols-2 lg:gap-16">
          <AiSummary summary={product.aiSummary} />

          <section aria-labelledby="description-heading">
            <Measure width="w-16" />
            <h2 id="description-heading" className="spec-label mt-4 text-muted">
              About this piece
            </h2>
            <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-ink">
              {product.description}
            </p>
          </section>
        </div>

        <div className="mt-20 border-t border-hairline pt-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md">
              <h2 className="display-wide text-2xl font-medium uppercase">
                Want it in another size?
              </h2>
              <p className="mt-3 leading-relaxed text-muted">
                This piece can be rebuilt to your measurements, in a different
                fabric or a different wood. Send us the room and we will quote
                it.
              </p>
            </div>
            <Button
              variant="outline"
              href={whatsappUrl(
                `Hello Standard Furniture — could you build ${product.name} to different measurements?`,
              )}
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
        <div className="mt-20 border-t border-hairline pt-10">
          <div className="max-w-2xl">
            <ReviewForm productId={product.id} productName={product.name} />
          </div>
        </div>
      </div>
    </Container>
  );
}

/** One line of the spec table. Label left, value right, hairline between. */
function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-hairline py-3">
      <dt className="spec-label text-muted">{label}</dt>
      <dd className="text-right font-mono text-sm text-ink">{value}</dd>
    </div>
  );
}
