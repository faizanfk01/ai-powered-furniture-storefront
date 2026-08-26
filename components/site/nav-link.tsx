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
 * `aria-current` is the part that matters. The brass colour tells a sighted
 * visitor where they are; without the attribute, nobody else is told at all.
 */
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`spec-label transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass ${
        active ? "text-brass" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
