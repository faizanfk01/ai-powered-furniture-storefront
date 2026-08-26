import type { Metadata } from "next";
import Link from "next/link";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Measure } from "@/components/ui/measure";
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
    "Sofas, beds, tables, chairs and office sets — every piece listed at its finished size, and any of them can be rebuilt to your measurements.",
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
      <section className="bg-ink-deep text-paper">
        <Container>
          <div className="py-16 sm:py-20">
            <Measure />
            <p className="spec-label mt-6 text-brass">Everything we make</p>
            <h1 className="display-wide mt-4 text-4xl font-semibold uppercase sm:text-6xl">
              Catalogue
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/75">
              Every piece is listed at its finished size. Anything here can be
              rebuilt to your measurements — the workshop is eight minutes from
              the showroom.
            </p>
          </div>
        </Container>
      </section>

      <Container>
        <div className="py-12 sm:py-16">
          <CatalogFilters
            categories={categories}
            params={params}
            resultCount={products.length}
          />

          {products.length > 0 && (
            <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          )}

          {/* Two different nothings, and they need different words. */}
          {products.length === 0 && (
            <div className="mt-16 max-w-lg border-t border-hairline pt-10">
              <Measure />

              {catalogueIsEmpty ? (
                <>
                  <h2 className="display-wide mt-6 text-2xl font-medium uppercase">
                    The catalogue is being photographed
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted">
                    Nothing is listed here yet. The workshop is still building
                    the first pieces for the site — message us and we will send
                    you what is on the showroom floor today.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="display-wide mt-6 text-2xl font-medium uppercase">
                    Nothing matches that
                  </h2>
                  <p className="mt-4 leading-relaxed text-muted">
                    {params.q ? (
                      <>
                        No piece in the catalogue matches{" "}
                        <span className="font-mono text-ink">
                          &ldquo;{params.q}&rdquo;
                        </span>
                        {(params.category || params.price) &&
                          " with those filters"}
                        . We build to order, so it is worth asking — most of
                        what we make never reaches this page.
                      </>
                    ) : (
                      <>
                        Nothing in the catalogue falls in that range. We build
                        to order, so it is worth asking — most of what we make
                        never reaches this page.
                      </>
                    )}
                  </p>
                </>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  href={whatsappUrl(
                    params.q
                      ? `Hello Standard Furniture — do you make ${params.q}?`
                      : "Hello Standard Furniture — I am looking for a piece I could not find on your site.",
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
          )}

          {/* One CTA for the whole grid rather than one per card: ten green
              glyphs down the page would be the loudest thing on it. */}
          {products.length > 0 && (
            <div className="mt-20 border-t border-hairline pt-10">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-md">
                  <h2 className="display-wide text-2xl font-medium uppercase">
                    Not quite the size you need?
                  </h2>
                  <p className="mt-3 leading-relaxed text-muted">
                    Every piece here can be rebuilt to different measurements,
                    in a different fabric or a different wood. Send us the room
                    and we will quote it.
                  </p>
                </div>

                <Button
                  href={whatsappUrl(
                    "Hello Standard Furniture — I would like a piece made to my own measurements.",
                  )}
                >
                  <WhatsAppIcon />
                  Message the workshop
                </Button>
              </div>
            </div>
          )}

          {/* Every category as a real link, so a crawler — and anyone without
              JavaScript — can reach the filtered views the select produces. */}
          <nav aria-label="Categories" className="mt-20 border-t border-hairline pt-8">
            <h2 className="spec-label text-muted">Browse by category</h2>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
              <li>
                <Link
                  href="/catalog"
                  className="spec-label text-muted transition-colors hover:text-ink"
                >
                  All
                </Link>
              </li>
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/catalog?category=${category.slug}`}
                    className={`spec-label transition-colors hover:text-ink ${
                      params.category === category.slug
                        ? "text-brass"
                        : "text-muted"
                    }`}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </>
  );
}
