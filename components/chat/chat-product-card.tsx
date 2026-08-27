import Image from "next/image";
import Link from "next/link";

import type { ChatProduct } from "@/lib/ai/facts";

/**
 * A product the assistant cited, as a card inside the transcript.
 *
 * Deliberately NOT components/catalog/product-card.tsx. That card is built for
 * a three-column grid on a page: a 4:3 image, three lines of description, a
 * footprint plan drawn when there is no photograph. Dropped into a 22rem panel
 * it would be most of the visible height, and one recommendation would push
 * the question that prompted it off screen.
 *
 * So this is the same information at a different altitude — the four facts
 * somebody uses to decide whether to tap through, in the same voices the
 * catalogue uses for them: category in the spec label, name in the display
 * face, price and dimensions in mono.
 *
 * The whole card is the tap target. On a phone, in a panel, a card that only
 * responds on its title is a card most people will think is not a link.
 */
export function ChatProductCard({ product }: { product: ChatProduct }) {
  const madeToOrder = product.stockStatus === "MADE_TO_ORDER";
  const outOfStock = product.stockStatus === "OUT_OF_STOCK";

  return (
    <Link
      href={product.href}
      className="group flex gap-3 border border-hairline bg-paper p-3 transition-colors hover:border-ink/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
    >
      {product.imageUrl ? (
        <div className="relative size-16 shrink-0 overflow-hidden bg-hairline/60">
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
          className="flex size-16 shrink-0 items-center justify-center border border-hairline bg-hairline/40 font-mono text-sm text-brass"
        >
          {product.ref}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="spec-label truncate text-muted">
            {product.categoryName}
          </span>
          <span
            className={`spec-label shrink-0 ${
              madeToOrder
                ? "text-brass"
                : outOfStock
                  ? "text-muted/60"
                  : "text-muted"
            }`}
          >
            {product.stockLabel}
          </span>
        </div>

        <p className="display-wide mt-1 text-sm leading-tight font-medium text-ink transition-colors group-hover:text-brass">
          {product.name}
        </p>

        <p className="mt-1.5 font-mono text-xs text-ink">{product.priceLabel}</p>

        {product.dimensions && (
          <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted">
            {product.dimensions}
          </p>
        )}
      </div>
    </Link>
  );
}
