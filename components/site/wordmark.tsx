import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * The name, set as signage.
 *
 * `display-wide` puts Archivo on its width axis — the same treatment as the
 * hero, at a size that fits a header bar. The two words are split so "STANDARD"
 * and "FURNITURE" can be tracked apart without letter-spacing swallowing the
 * space between them.
 */
export function Wordmark({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "paper";
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={`display-wide inline-flex items-baseline gap-[0.35em] text-base font-semibold tracking-[0.08em] uppercase sm:text-lg ${
        tone === "paper" ? "text-paper" : "text-ink"
      } ${className}`}
    >
      <span>Standard</span>
      <span className={tone === "paper" ? "text-paper/70" : "text-muted"}>
        Furniture
      </span>
      <span className="sr-only">— {SITE.town}</span>
    </Link>
  );
}
