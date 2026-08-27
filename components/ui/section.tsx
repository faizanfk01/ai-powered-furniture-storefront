import type { ReactNode } from "react";

import { Container } from "./container";

/**
 * A page band: vertical rhythm, ground colour, and the optional
 * eyebrow + heading + lede opening that gives every section the same entrance.
 *
 * Vertical padding lives here and nowhere else. When sections set their own
 * margins, two adjacent ones collapse or double depending on which was written
 * last, and the page's rhythm becomes an accident.
 *
 * TWO THINGS CHANGED, both about hierarchy rather than decoration:
 *
 *   - The <Measure /> rule above the eyebrow is gone. It was the showroom
 *     identity's signature ornament, and the clean direction earns its
 *     structure from space and weight instead. The component still exists for
 *     the pages that call it directly; those go in the later sub-steps.
 *   - `tone="surface"` is new — a very light neutral band, which is how a
 *     white storefront separates sections without reaching for the dark chrome
 *     every time. `ink` stays for the one or two bands that should stop the
 *     page.
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
  /** `surface` is the quiet band; `ink` is the dark one — hero and footer weight. */
  tone?: "paper" | "surface" | "ink";
  /** Small uppercase label above the heading. */
  eyebrow?: string;
  heading?: string;
  /** One sentence under the heading. Kept short by design. */
  lede?: string;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  const dark = tone === "ink";

  const ground =
    tone === "ink"
      ? "bg-ink-deep text-paper"
      : tone === "surface"
        ? "bg-surface text-ink"
        : "bg-paper text-ink";

  return (
    <section className={`${ground} py-16 sm:py-20 lg:py-24 ${className}`}>
      <Container width={width}>
        {(eyebrow || heading) && (
          <header className="mb-10 sm:mb-12">
            {eyebrow && (
              // Sentence case, like the heading under it. `spec-label` set
              // this in tracked-out capitals, which was the last of the
              // showroom's signage voice left in the primitive.
              <p
                className={`text-sm font-medium ${dark ? "text-brass" : "text-accent-strong"}`}
              >
                {eyebrow}
              </p>
            )}

            {heading && (
              // Sentence case, not uppercase. A tracked capital heading was
              // signage; this is a storefront, where the heading is read
              // rather than displayed. Weight and size carry it instead.
              <h2 className="display-wide mt-3 text-3xl font-semibold sm:text-4xl">
                {heading}
              </h2>
            )}

            {lede && (
              <p
                className={`mt-4 max-w-2xl text-lg leading-relaxed ${
                  dark ? "text-paper/70" : "text-muted"
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
