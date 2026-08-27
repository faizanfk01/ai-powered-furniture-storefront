import type { ReactNode } from "react";

/**
 * A surface.
 *
 * Rounded, hairline border, a shadow just heavy enough to separate it from
 * white without announcing itself. The old card was a bare hairline with no
 * radius and no shadow — correct for a broadsheet-flavoured showroom, wrong
 * for a storefront where a card needs to read as a discrete, tappable object.
 *
 * Still deliberately close to nothing. The catalogue's product card is built
 * from this plus its own contents rather than being a `variant` of it — a card
 * component that knows about prices and stock status stops being a primitive
 * and starts being the catalogue.
 */
export function Card({
  children,
  interactive = false,
  padded = false,
  className = "",
}: {
  children: ReactNode;
  /** Hover treatment for a card that is a link target. */
  interactive?: boolean;
  /** The common inner padding, so call sites stop re-deciding it. */
  padded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-paper shadow-sm ${
        padded ? "p-5 sm:p-6" : ""
      } ${
        interactive
          ? // A real lift, but a small one — 1px and a slightly deeper shadow.
            // Enough to say "this is a thing you can press" on a page of
            // otherwise flat panels, restrained enough not to bounce when a
            // grid of them is scrolled past.
            "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-md motion-reduce:hover:translate-y-0"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
