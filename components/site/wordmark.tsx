import Link from "next/link";

import { SITE } from "@/lib/site";

/**
 * The name, set as a retail wordmark.
 *
 * Was Archivo on its width axis, uppercase and letter-spaced — signage for the
 * showroom identity. Now Inter, sentence case, semibold, tracked slightly
 * tight: the treatment a modern storefront gives its own name in the corner of
 * a header, where the job is to be read and clicked rather than admired.
 *
 * The two words stay in separate spans so "Furniture" can sit a step back in
 * weight. That is the whole of the ornament now.
 */
export function Wordmark({
  tone = "ink",
  className = "",
}: {
  tone?: "ink" | "paper";
  className?: string;
}) {
  const paper = tone === "paper";

  return (
    <Link
      href="/"
      className={`inline-flex items-baseline gap-[0.3em] text-lg font-semibold tracking-[-0.02em] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass sm:text-xl ${
        paper ? "text-paper" : "text-ink"
      } ${className}`}
    >
      <span>Standard</span>
      <span className={`font-normal ${paper ? "text-paper/65" : "text-muted"}`}>
        Furniture
      </span>
      <span className="sr-only">, {SITE.town}</span>
    </Link>
  );
}
