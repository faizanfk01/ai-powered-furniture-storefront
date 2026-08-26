import type { ReactNode } from "react";

/**
 * A bordered surface.
 *
 * Deliberately close to nothing: a hairline, no radius, no shadow. The
 * catalogue's product card is built from this plus its own contents rather
 * than being a `variant` of it — a card component that knows about prices and
 * stock status stops being a primitive and starts being the catalogue.
 *
 * `interactive` adds the hover treatment for a card that is a link target. It
 * changes the border rather than lifting the card, because nothing else in
 * this system moves on hover.
 */
export function Card({
  children,
  interactive = false,
  className = "",
}: {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`border border-hairline bg-paper ${
        interactive ? "transition-colors hover:border-ink/30" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
