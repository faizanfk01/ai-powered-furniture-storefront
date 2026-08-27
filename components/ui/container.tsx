import type { ReactNode } from "react";

/**
 * The horizontal frame every page sits in.
 *
 * One measurement, defined once. Slightly wider and with a gentler gutter
 * ramp than before: a white page needs more room at the edges than an
 * ink-bounded one did, and 4/6/8 across the breakpoints keeps a phone from
 * spending a tenth of its width on margin.
 *
 * `wide` exists for the catalogue grid, which needs a fourth column at large
 * sizes to avoid cards that stretch wider than the photographs they hold.
 * `narrow` is new, for reading measures — forms and prose, where a 72rem line
 * length is unreadable.
 */
export function Container({
  children,
  width = "default",
  className = "",
}: {
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  const max =
    width === "wide" ? "max-w-7xl" : width === "narrow" ? "max-w-3xl" : "max-w-6xl";

  return (
    <div className={`mx-auto w-full ${max} px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
