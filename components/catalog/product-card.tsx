import Image from "next/image";
import Link from "next/link";

import { Card } from "@/components/ui/card";
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
 * The heading carries the link and a `::before` overlay stretches it across
 * the card, so the accessible name stays "Karachi 3-Seater Fabric Sofa" rather
 * than the whole card's text read aloud, and the description underneath stays
 * selectable.
 *
 * Reads top to bottom the way the decision is made: what it looks like (or how
 * big it is), what kind of thing it is, what it is called, what it is, what it
 * costs.
 *
 * NOW A REAL CARD. It used to be a bare column on the page ground, separated
 * from its neighbours by whitespace alone — right for a broadsheet, wrong for
 * a storefront where each result should read as a discrete, tappable object.
 * It is built on the Card primitive, so the radius, the border and the hover
 * lift are the system's rather than this file's.
 */
export function ProductCard({ product }: { product: SearchedProduct }) {
  // productInclude orders images by sortOrder, so the first is the one the
  // admin put first.
  const image = product.images[0];
  const madeToOrder = product.stockStatus === "MADE_TO_ORDER";
  const outOfStock = product.stockStatus === "OUT_OF_STOCK";

  // Made to order is the interesting answer for a workshop, not a lesser one,
  // so it gets the accent tint. Out of stock is stated plainly and quietly —
  // greying it into illegibility hides a fact somebody needs.
  const stockTone = madeToOrder
    ? "bg-accent-soft text-accent-strong"
    : outOfStock
      ? "bg-surface text-muted"
      : "bg-surface text-ink";

  return (
    // `relative` anchors the stretched link overlay; `group` lets the image and
    // the title respond to a hover anywhere on the card; `overflow-hidden`
    // clips the photograph to the card's radius.
    <Card interactive className="@container group relative h-full overflow-hidden">
      {/* h-full so `mt-auto` on the price block below actually reaches the
          bottom: the prices line up across a row of cards whose descriptions
          differ in length. */}
      <article className="flex h-full flex-col">
        {image ? (
          <div className="relative aspect-4/3 overflow-hidden bg-surface">
            <Image
              src={image.url}
              alt={image.alt || product.name}
              fill
              // Matches the grid: two columns on phones, two at sm, three at
              // lg, four at xl, five at 3xl. Without this every card downloads
              // a full-width image. The 3xl entry is not decoration — a fifth
              // column makes each card NARROWER, so leaving it out would have
              // the widest screens fetching the largest images for the
              // smallest cards on the site.
              //
              // The phone entry is 50vw rather than 100vw because the
              // catalogue is two-up below `sm` now. It collapses with the
              // `sm` entry into one 50vw fallback, which covers everything
              // under 1024px.
              sizes="(min-width: 1920px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
              // A slow, small zoom on hover. The card itself only lifts 1px,
              // so this is what actually says the photograph is a door.
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          </div>
        ) : (
          <FootprintPlan dimensions={product.dimensions} />
        )}

        {/* COMPACT BELOW 13rem OF CARD, measured on the card and not on the
            window. The catalogue is two-up on a phone, which leaves each card
            138–173px wide; the home page's strip is still one-up, which leaves
            it ~358px. A `max-sm:` breakpoint would shrink both, because it can
            only see the viewport they happen to share. `@container` asks the
            question that actually matters — how much room does THIS card
            have — so the same component reads correctly in both grids and in
            whatever grid comes next. */}
        <div className="flex flex-1 flex-col p-3.5 @max-[13rem]:p-2.5 sm:p-4 lg:p-5">
          {/* Category and stock sit side by side until they cannot: "Dining"
              plus "Made to order" is ~150px of unbreakable text, so on a
              narrow card the badge drops to its own line instead of squeezing
              the category into two characters and an ellipsis. */}
          <div className="flex items-center justify-between gap-3 @max-[13rem]:flex-col @max-[13rem]:items-start @max-[13rem]:gap-1.5">
            <span className="min-w-0 max-w-full truncate text-xs text-muted">
              {product.category.name}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap @max-[13rem]:px-1.5 @max-[13rem]:text-[10px] ${stockTone}`}
            >
              {STOCK_LABEL[product.stockStatus]}
            </span>
          </div>

          <h3 className="display-wide mt-2 text-base leading-snug font-semibold @max-[13rem]:mt-1.5 @max-[13rem]:text-sm">
            <Link
              href={productPath(product.slug)}
              className="before:absolute before:inset-0 before:content-[''] group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
            >
              {product.name}
            </Link>
          </h3>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted @max-[13rem]:mt-1.5 @max-[13rem]:text-xs">
            {product.description}
          </p>

          {/* Price and measurements together at the foot of the card: the two
              facts you compare across pieces, on the line your eye returns to.
              `tabular` so the rupee figures line up down a column. */}
          <div className="mt-auto pt-4 @max-[13rem]:pt-3">
            <p className="tabular text-base font-semibold text-ink @max-[13rem]:text-sm">
              {formatPrice(product.price)}
            </p>
            {product.dimensions && (
              // `break-words` so a long measurement wraps inside the card
              // rather than pushing a horizontal scrollbar out of it at 320px.
              <p className="tabular mt-0.5 text-xs break-words text-muted @max-[13rem]:text-[11px]">
                {product.dimensions}
              </p>
            )}
          </div>
        </div>
      </article>
    </Card>
  );
}
