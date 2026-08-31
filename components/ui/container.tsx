import type { ReactNode } from "react";

/**
 * The horizontal frame every page sits in.
 *
 * One measurement, defined once — but not ONE measurement any more. The
 * previous version capped at 72rem (default) and 80rem (wide) and stopped
 * there, which is why a 1440px monitor showed a column in an ocean of margin
 * and a 1920px one showed two oceans. A max-width that is right at 1280 is not
 * right at 1920; it has to keep growing, just more slowly than the screen.
 *
 * THE RAMP, and why it stops where it does:
 *
 *   default   72rem → 80rem (xl) → 86rem (2xl) → 96rem (3xl)
 *   wide      80rem → 84rem (xl) → 92rem (2xl) → 108rem (3xl)
 *
 * `wide` is the catalogue's frame, so it climbs fastest — a grid of
 * photographs is the one thing on this site that genuinely wants the whole
 * monitor. At 1920 it is 1728px, which leaves a 96px margin either side: the
 * page still reads as a page rather than as content pinned to the bezel.
 *
 * `default` climbs more slowly because it frames prose and forms as well as
 * cards, and a 1700px line of body copy is unreadable however much monitor
 * there is. `narrow` does not climb at all — it IS the reading measure, and
 * widening it would defeat the only thing it is for.
 *
 * The gutter ramps 4/6/8/10 rather than stopping at 8. The extra step is what
 * keeps the widened frames from putting text within a thumb's width of the
 * screen edge on a large display.
 *
 * `3xl` is this project's own breakpoint (120rem), declared in
 * app/globals.css — Tailwind ships nothing above 2xl / 96rem, which is exactly
 * the range where the old caps looked worst.
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
    width === "wide"
      ? "max-w-7xl xl:max-w-[84rem] 2xl:max-w-[92rem] 3xl:max-w-[108rem]"
      : width === "narrow"
        ? "max-w-3xl"
        : "max-w-6xl xl:max-w-7xl 2xl:max-w-[86rem] 3xl:max-w-[96rem]";

  return (
    <div
      className={`mx-auto w-full ${max} px-4 sm:px-6 lg:px-8 xl:px-10 ${className}`}
    >
      {children}
    </div>
  );
}
