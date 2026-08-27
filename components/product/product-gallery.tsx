import Image from "next/image";

import { FootprintPlan } from "@/components/catalog/footprint-plan";
import type { SearchedProduct } from "@/lib/product-search";

/**
 * The product's images, or the plan when there are none.
 *
 * No JavaScript: the first image is shown large and the rest follow beneath in
 * a grid, rather than a thumbnail strip that swaps a main image. A lightbox is
 * a real improvement to make later — but it would be built now against zero
 * photographs, which means built blind and never exercised. The layout below
 * is what a gallery degrades to anyway with JS off, so this is the honest
 * floor to start from.
 *
 * `images` arrives ordered by sortOrder via productInclude, so "first" means
 * the one the admin put first.
 *
 * RESTYLED ONLY. The no-JS structure, the eager lead image and the sizes
 * hints are unchanged; the frames are now rounded on the light neutral surface
 * rather than square on the hairline tint, matching the catalogue cards.
 */
export function ProductGallery({ product }: { product: SearchedProduct }) {
  const [lead, ...rest] = product.images;

  if (!lead) {
    // The same drawing the catalogue cards use, given the detail padding and
    // the gallery's radius. The parser and the shared 120" ruler are untouched.
    return (
      <FootprintPlan
        dimensions={product.dimensions}
        size="detail"
        className="rounded-xl border border-hairline"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-4/3 overflow-hidden rounded-xl border border-hairline bg-surface">
        <Image
          src={lead.url}
          alt={lead.alt || product.name}
          fill
          // The lead image is above the fold on the conversion page — load it
          // immediately rather than lazily. `priority` is deprecated in
          // Next 16 in favour of saying what you mean.
          loading="eager"
          fetchPriority="high"
          // Half the viewport once the page goes two-column at lg.
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      {rest.length > 0 && (
        <ul className="grid grid-cols-3 gap-4">
          {rest.map((image) => (
            <li key={image.id}>
              <div className="relative aspect-square overflow-hidden rounded-lg border border-hairline bg-surface">
                <Image
                  src={image.url}
                  alt={image.alt || product.name}
                  fill
                  sizes="(min-width: 1024px) 17vw, 33vw"
                  className="object-cover"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
