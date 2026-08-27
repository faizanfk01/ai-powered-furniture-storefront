"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A single nav item that knows whether it is the current page.
 *
 * Client, because `usePathname` is the only way to answer that — but a leaf
 * one. The header, the wordmark and the link list stay on the server; what
 * ships to the browser is this component and the href it was handed.
 *
 * `aria-current` is the part that matters. The colour tells a sighted visitor
 * where they are; without the attribute, nobody else is told at all.
 *
 * Restyled for the dark bar: sentence case at a normal reading weight, with
 * the state carried by opacity — /70 at rest, full paper on hover, and full
 * paper plus a brass underline for the current page. The old uppercase,
 * letter-spaced `spec-label` was showroom signage; a nav on a retail header
 * reads as words, not as a plaque.
 */
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // The underline is a pseudo-element rather than a border so it can sit
      // clear of the text baseline without the link box growing when it
      // appears — a nav that shifts by a pixel on hover is the tell of a
      // hand-made header.
      className={`relative inline-block py-2 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-brass after:transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass ${
        active
          ? "text-paper after:opacity-100"
          : "text-paper/70 after:opacity-0 hover:text-paper hover:after:opacity-60"
      }`}
    >
      {label}
    </Link>
  );
}
