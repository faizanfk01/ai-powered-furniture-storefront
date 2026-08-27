import Link from "next/link";
import type { ReactNode } from "react";

import type { ChatProduct } from "@/lib/ai/facts";

/**
 * The assistant's prose, with its citations turned into real links.
 *
 * The backend hands back text carrying `[P1]`-style tags and a separate list
 * of the products those tags refer to — rows, with their own slugs. Resolving
 * one against the other happens here, and it is the last step of the same
 * argument the whole phase is built on: the model never writes a URL, so a
 * link in this panel cannot point anywhere except at a product that came out
 * of the database.
 *
 * WHY A FOOTNOTE MARK RATHER THAN LINKING THE NAME. The reply reads "the
 * Karachi 3-Seater Fabric Sofa [P1] is built on a sheesham frame" — the name
 * is already there, in the model's own sentence. Turning the tag into the name
 * again would stutter; finding the name in the prose and linking it in place
 * would mean string-matching model output against a row, which is exactly the
 * kind of guessing this codebase avoids. A numbered mark is honest about what
 * it is: a reference to the card below, in the same brass the rest of the site
 * uses for marks.
 *
 * A tag with no matching product is dropped rather than shown. It should never
 * arrive — lib/ai/grounding.ts rejects any reply citing outside the retrieved
 * set — but if one ever did, a raw "[P9]" in the transcript would be the one
 * piece of visible evidence that the grounding check had failed, and silently
 * dropping it is better than rendering a dead reference to a customer.
 */

const CITATION_PATTERN = /\[P(\d+)\]/g;

export function ChatReply({
  text,
  products,
}: {
  text: string;
  products: ChatProduct[];
}) {
  const byRef = new Map(products.map((product) => [product.ref, product]));
  const nodes: ReactNode[] = [];

  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(CITATION_PATTERN)) {
    const start = match.index;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    cursor = start + match[0].length;

    const product = byRef.get(Number(match[1]));
    if (!product) continue;

    nodes.push(
      <Link
        key={`ref-${key++}`}
        href={product.href}
        // `align-super` rather than a <sup>: the mono face at this size sits
        // correctly on the serif baseline without the browser's own font-size
        // reduction making it unreadable on a phone.
        className="ml-0.5 inline-block align-super font-mono text-[0.65em] text-brass underline decoration-brass/40 underline-offset-2 transition-colors hover:decoration-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <span className="sr-only">See </span>
        {product.ref}
        <span className="sr-only">. {product.name}</span>
      </Link>,
    );
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));

  // `whitespace-pre-line` because the model writes short lists as real
  // newlines, and so does the deterministic fallback reply in
  // lib/ai/grounding.ts. Collapsing them would run the products together.
  return (
    <p className="leading-relaxed whitespace-pre-line text-ink">{nodes}</p>
  );
}
