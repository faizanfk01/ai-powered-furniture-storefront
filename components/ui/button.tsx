import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The one button in the system.
 *
 * Rounded, sentence case, medium weight — standard retail. The square,
 * uppercase, letter-spaced button this replaces belonged to the showroom
 * identity, where it echoed the ruler and the footprint plans; in a clean
 * storefront it reads as a shout.
 *
 * Renders as <button>, next/link, or a plain <a> depending on what it is
 * pointing at, because these three end up styled identically in every design
 * system and then drift apart the moment they are three separate components.
 * That behaviour is unchanged — this pass only restyles.
 */

type Variant = "solid" | "outline" | "solid-invert" | "outline-invert";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  /** On white: the primary action. The brand dark, doing its one loud job. */
  solid: "bg-ink text-paper hover:bg-ink/90 active:bg-ink",
  /** On white: the secondary action. A real edge, filled only on hover. */
  outline:
    "border border-line-strong bg-paper text-ink hover:border-ink/40 hover:bg-surface active:bg-hairline/60",
  /** On a dark band: the primary action. */
  "solid-invert": "bg-paper text-ink hover:bg-white/90 active:bg-white",
  /** On a dark band: the secondary action. */
  "outline-invert":
    "border border-paper/25 text-paper hover:border-paper/50 hover:bg-paper/10 active:bg-paper/15",
};

const SIZES: Record<Size, string> = {
  sm: "gap-2 rounded-md px-3.5 py-2 text-sm",
  md: "gap-2 rounded-lg px-5 py-2.5 text-sm",
  lg: "gap-2.5 rounded-lg px-6 py-3 text-base",
};

const BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap " +
  // Colour only. Nothing here moves, scales or lifts: the hover is a state
  // change, not an event, and a button that jumps under the cursor is the
  // first thing that makes a retail page feel fussy.
  "transition-colors duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  // Visible keyboard focus on both grounds: the offset ring picks up the
  // band's own colour rather than assuming a light background.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  href?: string;
  className?: string;
} & Omit<ComponentProps<"button">, "className" | "children">;

export function Button({
  children,
  variant = "solid",
  size = "md",
  href,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`;

  if (href) {
    // wa.me and tel: are not app routes — next/link would try to prefetch them.
    const external = /^(https?:|tel:|mailto:)/.test(href);

    if (external) {
      return (
        <a
          href={href}
          className={classes}
          // noreferrer alongside noopener: the WhatsApp link should not leak
          // which product page the customer came from.
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }

    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
