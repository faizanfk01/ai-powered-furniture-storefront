import Image from "next/image";
import Link from "next/link";

import { formatPrice, STOCK_LABEL } from "@/lib/format";
import type { SearchedProduct } from "@/lib/product-search";
import { productPath } from "@/lib/url";

import { FootprintPlan } from "./footprint-plan";

/**
 * One piece in the catalogue.
 *
 * The whole card is the link target, not just the title — a name is a small
 * tap on a phone, and everything in the card is about the same piece.
 *
 * The heading carries the link and a `::after` overlay stretches it across the
 * card, so the accessible name stays "Karachi 3-Seater Fabric Sofa" rather
 * than the whole card's text read aloud, and the description underneath stays
 * selectable.
 *
 * Reads top to bottom the way the decision is made: what it looks like (or how
 * big it is), what kind of thing it is, what it is called, what it is, what it
 * costs.
 */
export function ProductCard({ product }: { product: SearchedProduct }) {
  // productInclude orders images by sortOrder, so the first is the one the
  // admin put first.
  const image = product.images[0];
  const madeToOrder = product.stockStatus === "MADE_TO_ORDER";
  const outOfStock = product.stockStatus === "OUT_OF_STOCK";

  return (
    // h-full so `mt-auto` on the spec line below actually reaches the bottom:
    // the price rows line up across a row of cards whose descriptions differ
    // in length. `relative` anchors the stretched link overlay; `group` lets
    // the image and title respond to a hover anywhere on the card.
    <article className="group relative flex h-full flex-col">
      {image ? (
        <div className="relative aspect-4/3 overflow-hidden bg-hairline/60">
          <Image
            src={image.url}
            alt={image.alt || product.name}
            fill
            // Matches the grid below: one column on phones, two at sm, three
            // at lg. Without this every card downloads a full-width image.
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      ) : (
        <FootprintPlan dimensions={product.dimensions} />
      )}

      <div className="mt-5 flex items-baseline justify-between gap-4">
        <span className="spec-label text-muted">{product.category.name}</span>
        <span
          className={`spec-label ${
            madeToOrder ? "text-brass" : outOfStock ? "text-muted/60" : "text-muted"
          }`}
        >
          {STOCK_LABEL[product.stockStatus]}
        </span>
      </div>

      <h3 className="display-wide mt-3 text-xl leading-tight font-medium">
        <Link
          href={productPath(product.slug)}
          className="transition-colors before:absolute before:inset-0 before:content-[''] group-hover:text-brass focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
        >
          {product.name}
        </Link>
      </h3>

      <p className="mt-3 line-clamp-3 leading-relaxed text-muted">
        {product.description}
      </p>

      {/* The spec line: price and the measurements, in the same mono voice, so
          the two facts you compare across pieces sit together. */}
      <div className="mt-auto border-t border-hairline pt-4">
        <p className="pt-1 font-mono text-sm text-ink">
          {formatPrice(product.price)}
        </p>
        {product.dimensions && (
          <p className="mt-1 font-mono text-xs text-muted">
            {product.dimensions}
          </p>
        )}
      </div>
    </article>
  );
}
