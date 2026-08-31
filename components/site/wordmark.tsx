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
 *
 * Three sizes rather than two, starting a step smaller. The name is the widest
 * fixed thing in the header bar, and at 320px the old text-lg floor was what
 * tipped the row over its gutters. `whitespace-nowrap` is deliberate: the two
 * words are one mark and must never wrap to a second line inside the bar.
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
      className={`inline-flex items-baseline gap-[0.3em] text-base font-semibold whitespace-nowrap tracking-[-0.02em] transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass sm:text-lg lg:text-xl ${
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
