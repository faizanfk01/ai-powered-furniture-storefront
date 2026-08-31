"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * One item in the admin sidebar.
 *
 * Client, for `usePathname` — but a leaf, so the shell around it stays on the
 * server. `exact` is for /admin itself, which would otherwise match every
 * page beneath it and mark the dashboard current from anywhere in the tool.
 *
 * `pending` marks a destination that does not exist yet. It renders as a plain
 * non-link with a "soon" tag rather than a link to a 404: the owner should be
 * able to see what is coming without being punished for clicking it.
 */
export function AdminNavLink({
  href,
  label,
  exact = false,
  pending = false,
}: {
  href: string;
  label: string;
  exact?: boolean;
  pending?: boolean;
}) {
  const pathname = usePathname();

  if (pending) {
    return (
      <span className="flex items-center justify-between gap-2 px-3 py-2 text-sm whitespace-nowrap text-paper/35">
        {label}
        <span className="spec-label text-paper/25">Soon</span>
      </span>
    );
  }

  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // whitespace-nowrap because below lg these sit in a scrolling row, not a
      // column, and "Categories" breaking over two lines would set the height
      // of the whole strip.
      className={`block px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
        active
          ? "bg-paper/10 font-medium text-paper"
          : "text-paper/65 hover:bg-paper/5 hover:text-paper"
      }`}
    >
      {label}
    </Link>
  );
}
