import type { ReactNode } from "react";

import { Container } from "./container";
import { Measure } from "./measure";

/**
 * A page band: vertical rhythm, ground colour, and the optional
 * measure + eyebrow + heading opening that gives every section the same
 * entrance.
 *
 * Vertical padding lives here and nowhere else. When sections set their own
 * margins, two adjacent ones collapse or double depending on which was written
 * last, and the page's rhythm becomes an accident.
 */
export function Section({
  children,
  tone = "paper",
  eyebrow,
  heading,
  lede,
  width = "default",
  className = "",
}: {
  children?: ReactNode;
  /** `ink` is the dark band — hero and footer weight. */
  tone?: "paper" | "ink";
  /** Small mono label above the heading. */
  eyebrow?: string;
  heading?: string;
  /** One sentence under the heading. Kept short by design. */
  lede?: string;
  width?: "default" | "wide";
  className?: string;
}) {
  const dark = tone === "ink";

  return (
    <section
      className={`${dark ? "bg-ink-deep text-paper" : "bg-paper text-ink"} py-20 sm:py-28 ${className}`}
    >
      <Container width={width}>
        {(eyebrow || heading) && (
          <header className="mb-12">
            <Measure />

            {eyebrow && (
              <p className={`spec-label mt-6 ${dark ? "text-brass" : "text-muted"}`}>
                {eyebrow}
              </p>
            )}

            {heading && (
              <h2 className="display-wide mt-4 text-3xl font-semibold uppercase sm:text-4xl">
                {heading}
              </h2>
            )}

            {lede && (
              <p
                className={`mt-4 max-w-xl text-lg leading-relaxed ${
                  dark ? "text-paper/75" : "text-muted"
                }`}
              >
                {lede}
              </p>
            )}
          </header>
        )}

        {children}
      </Container>
    </section>
  );
}
