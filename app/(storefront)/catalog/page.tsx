import type { Metadata } from "next";
import Link from "next/link";

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
        <div className="pt-12 pb-8 sm:pt-16 sm:pb-10">
          <p className="text-sm font-medium text-accent-strong">
            Everything we make
          </p>
          <h1 className="display-wide mt-3 text-4xl font-semibold sm:text-5xl">
            Catalogue
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            Every piece is listed at its finished size. Anything here can be
            built to your measurements. The workshop is eight minutes from the
            showroom.
          </p>
        </div>
      </Container>

      <Container width="wide">
        <div className="pb-16 sm:pb-20">
          <CatalogFilters
            categories={categories}
            params={params}
            resultCount={products.length}
          />

          {products.length > 0 && (
            // Four columns at xl — the reason Container has a `wide`. A
            // three-up grid on a 1440px screen gives each card more width than
            // the photograph inside it has resolution for.
            <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}

          {/* Two different nothings, and they need different words. */}
          {products.length === 0 && (
            <Card padded className="mt-8 sm:p-10">
              <div className="max-w-lg">
                {catalogueIsEmpty ? (
                  <>
                    <h2 className="display-wide text-2xl font-semibold">
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
                    <h2 className="display-wide text-2xl font-semibold">
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
            <div className="mt-14 rounded-xl border border-hairline bg-surface p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-md">
                  <h2 className="display-wide text-xl font-semibold sm:text-2xl">
                    Not quite the size you need?
                  </h2>
                  <p className="mt-2 leading-relaxed text-muted">
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

          {/* Every category as a real link, so a crawler — and anyone without
              JavaScript — can reach the filtered views the select produces.
              Pills rather than a row of tracked-out capitals: this is a second
              way to use the filter above, and it should look like controls. */}
          <nav
            aria-label="Categories"
            className="mt-14 border-t border-hairline pt-8"
          >
            <h2 className="text-sm font-semibold text-ink">
              Browse by category
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              <li>
                <Link
                  href="/catalog"
                  aria-current={!params.category ? "true" : undefined}
                  className={`inline-block rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
                    !params.category
                      ? "border-ink bg-ink text-paper"
                      : "border-hairline bg-paper text-muted hover:border-line-strong hover:text-ink"
                  }`}
                >
                  All
                </Link>
              </li>
              {categories.map((category) => {
                const active = params.category === category.slug;

                return (
                  <li key={category.id}>
                    <Link
                      href={`/catalog?category=${category.slug}`}
                      aria-current={active ? "true" : undefined}
                      className={`inline-block rounded-full border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
                        active
                          ? "border-ink bg-ink text-paper"
                          : "border-hairline bg-paper text-muted hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      {category.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </Container>
    </>
  );
}
