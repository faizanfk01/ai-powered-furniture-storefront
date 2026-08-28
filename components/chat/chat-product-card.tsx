import Image from "next/image";
import Link from "next/link";

import type { ChatProduct } from "@/lib/ai/facts";

/**
 * A product the assistant cited, as a card inside the transcript.
 *
 * Deliberately NOT components/catalog/product-card.tsx. That card is built for
 * a grid on a page: a 4:3 image, two lines of description, a footprint plan
 * drawn when there is no photograph. Dropped into a 26rem panel it would be
 * most of the visible height, and one recommendation would push the question
 * that prompted it off screen.
 *
 * So this is the same information at a different altitude — the four facts
 * somebody uses to decide whether to tap through. It now wears the catalogue
 * card's clothes at that smaller size: the same radius, the same hairline, the
 * same rounded stock pill with the accent tint for made-to-order, and the
 * price in tabular figures. A customer should recognise it as the same object
 * they saw in the grid.
 *
 * The whole card is the tap target. On a phone, in a panel, a card that only
 * responds on its title is a card most people will think is not a link.
 */
export function ChatProductCard({ product }: { product: ChatProduct }) {
  const madeToOrder = product.stockStatus === "MADE_TO_ORDER";
  const outOfStock = product.stockStatus === "OUT_OF_STOCK";

  // The same three tones as the catalogue card and the product page.
  const stockTone = madeToOrder
    ? "bg-accent-soft text-accent-strong"
    : outOfStock
      ? "bg-surface text-muted"
      : "bg-surface text-ink";

  return (
    <Link
      href={product.href}
      className="group flex gap-3 rounded-xl border border-hairline bg-paper p-3 shadow-sm transition-[box-shadow,border-color] hover:border-line-strong hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
    >
      {product.imageUrl ? (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface">
          <Image
            src={product.imageUrl}
            alt=""
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>
      ) : (
        // No photograph yet on any row in this catalogue, so this is the state
        // that actually renders. A grey box would read as a broken image; the
        // reference number ties the card to the mark in the sentence above it,
        // which is the job the thumbnail would otherwise do.
        <div
          aria-hidden="true"
          className="tabular flex size-16 shrink-0 items-center justify-center rounded-lg border border-hairline bg-surface text-sm font-medium text-accent-strong"
        >
          {product.ref}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted">
            {product.categoryName}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${stockTone}`}
          >
            {product.stockLabel}
          </span>
        </div>

        <p className="display-wide mt-1 text-sm leading-snug font-semibold text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">
          {product.name}
        </p>

        <p className="tabular mt-1 text-sm font-semibold text-ink">
          {product.priceLabel}
        </p>

        {product.dimensions && (
          <p className="tabular mt-0.5 truncate text-[0.6875rem] text-muted">
            {product.dimensions}
          </p>
        )}
      </div>
    </Link>
  );
}
