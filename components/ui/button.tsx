import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The one button in the system.
 *
 * Square corners, uppercase display face, no shadow — the same flat, precise
 * geometry as the measure and the footprint rectangles. A rounded, shadowed
 * button would be the single element on the page borrowed from a different
 * design language.
 *
 * Renders as <button>, next/link, or a plain <a> depending on what it is
 * pointing at, because these three end up styled identically in every design
 * system and then drift apart the moment they are three separate components.
 */

type Variant = "solid" | "outline" | "solid-invert" | "outline-invert";

const VARIANTS: Record<Variant, string> = {
  /** On paper: the primary action. */
  solid: "bg-ink text-paper hover:bg-ink-deep",
  /** On paper: the secondary action. */
  outline: "border border-ink/25 text-ink hover:border-ink hover:bg-ink/5",
  /** On an ink band: the primary action. */
  "solid-invert": "bg-paper text-ink hover:bg-white",
  /** On an ink band: the secondary action. */
  "outline-invert":
    "border border-paper/30 text-paper hover:border-paper/70 hover:bg-paper/10",
};

const BASE =
  "inline-flex items-center justify-center gap-2.5 px-6 py-3 font-display text-sm font-medium tracking-wide uppercase transition-colors " +
  // Visible keyboard focus on both grounds: the offset ring picks up the
  // band's own colour rather than assuming a light background.
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  className?: string;
} & Omit<ComponentProps<"button">, "className" | "children">;

export function Button({
  children,
  variant = "solid",
  href,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`;

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
