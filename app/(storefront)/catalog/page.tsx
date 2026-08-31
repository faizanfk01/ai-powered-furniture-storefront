import type { Metadata } from "next";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import {
  hasActiveFilters,
  parseCatalogParams,
  priceBand,
} from "@/lib/catalog-filters";
import { db } from "@/lib/db";
import { searchProducts } from "@/lib/product-search";
import { whatsappUrl } from "@/lib/site";
import { MAX_SEARCH_LIMIT } from "@/lib/validations";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Sofas, beds, tables, chairs and office sets. Every piece is listed at its finished size, and any of them can be built to your measurements.",
};

/**
 * The catalogue.
 *
 * Reads the database directly through the db singleton, per the phase's data
 * decision — no HTTP hop to our own API from a Server Component. It shares the
 * query with the search endpoint via lib/product-search.ts, so the two cannot
 * answer the same question differently.
 *
 * Filter state lives in the URL; see the note at the top of
 * lib/catalog-filters.ts for why that decision drives everything else here.
 */
export default async function CatalogPage({
  searchParams,
}: PageProps<"/catalog">) {
  const params = parseCatalogParams(await searchParams);

  // Categories drive the filter and also translate the URL's slug into the id
  // the query wants. One query serves both, so the slug never needs a second
  // lookup.
  const categories = await db.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });

  // A slug that matches nothing — a deleted category, a hand-edited URL —
  // resolves to undefined and is simply not applied. Browsing is not a write
  // boundary; a stale link should show the catalogue, not an error.
  const categoryId = categories.find(
    (category) => category.slug === params.category,
  )?.id;

  const band = priceBand(params.price);

  const products = await searchProducts({
    q: params.q,
    categoryId,
    priceMin: band?.min,
    priceMax: band?.max,
    limit: MAX_SEARCH_LIMIT,
    offset: 0,
  });

  const filtered = hasActiveFilters(params);
  const catalogueIsEmpty = !filtered && products.length === 0;

  return (
    <>
      {/* ------------------------------------------------------------------
          PAGE HEAD — on white. It was an ink band opening with the ruler mark
          and CATALOGUE set as uppercase signage; the dark now belongs to the
          header directly above it, and two dark bands stacked read as one
          oversized header rather than as a page beginning.
         ------------------------------------------------------------------ */}
      <Container width="wide">
        <div className="pt-8 pb-6 sm:pt-12 sm:pb-8 lg:pt-16 lg:pb-10">
          <p className="text-sm font-medium text-accent-strong">
            Everything we make
          </p>
          <h1 className="display-wide mt-2 text-3xl font-semibold sm:mt-3 sm:text-4xl lg:text-5xl">
            Catalogue
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted sm:mt-4 sm:text-lg">
            Every piece is listed at its finished size. Anything here can be
            built to your measurements. The workshop is eight minutes from the
            showroom.
          </p>
        </div>
      </Container>

      <Container width="wide">
        <div className="pb-12 sm:pb-16 lg:pb-20">
          <CatalogFilters
            categories={categories}
            params={params}
            resultCount={products.length}
          />

          {products.length > 0 && (
            // Four columns at xl, five at 3xl — the reason Container has a
            // `wide`, and the reason that `wide` now keeps growing past
            // Tailwind's last breakpoint. A three-up grid on a 1440px screen
            // gives each card more width than the photograph inside it has
            // resolution for; a four-up grid on a 1920px one does the same
            // thing again, one screen size later.
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5">
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}

          {/* Two different nothings, and they need different words. */}
          {products.length === 0 && (
            <Card padded className="mt-6 sm:mt-8 lg:p-10">
              <div className="max-w-lg">
                {catalogueIsEmpty ? (
                  <>
                    <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                      We are still photographing everything
                    </h2>
                    <p className="mt-3 leading-relaxed text-muted">
                      Nothing is listed here yet. The workshop is still building
                      the first pieces for the site. Message us and we will send
                      you what is on the showroom floor today.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                      Nothing matches that
                    </h2>
                    <p className="mt-3 leading-relaxed text-muted">
                      {params.q ? (
                        <>
                          Nothing in the catalogue matches{" "}
                          <span className="font-medium text-ink">
                            &ldquo;{params.q}&rdquo;
                          </span>
                          {(params.category || params.price) &&
                            " with those filters"}
                          . We build to order, so it is still worth asking. A
                          lot of what we make never reaches this page.
                        </>
                      ) : (
                        <>
                          Nothing in the catalogue is in that price range. We
                          build to order, so it is still worth asking. A lot of
                          what we make never reaches this page.
                        </>
                      )}
                    </p>
                  </>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    href={whatsappUrl(
                      params.q
                        ? `Hello Standard Furniture, do you make ${params.q}?`
                        : "Hello Standard Furniture, I am looking for something I could not find on your site.",
                    )}
                  >
                    <WhatsAppIcon />
                    Ask the workshop
                  </Button>

                  {filtered && (
                    <Button variant="outline" href="/catalog">
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* One CTA for the whole grid rather than one per card: ten green
              glyphs down the page would be the loudest thing on it. */}
          {products.length > 0 && (
            <div className="mt-10 rounded-xl border border-hairline bg-surface p-5 sm:mt-14 sm:p-6 lg:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-md">
                  <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                    Not quite the size you need?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                    We can build any of these to different measurements, in
                    another fabric or another wood. Tell us about the room and
                    we will give you a price.
                  </p>
                </div>

                <Button
                  href={whatsappUrl(
                    "Hello Standard Furniture, I would like a piece made to my own measurements.",
                  )}
                  className="shrink-0"
                >
                  <WhatsAppIcon />
                  Message the workshop
                </Button>
              </div>
            </div>
          )}
        </div>
      </Container>
    </>
  );
}
