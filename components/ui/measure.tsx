/**
 * The measure — a ruler edge in brass.
 *
 * The `measure` utility in globals.css draws it from `currentColor`, so the
 * colour is set here in one place rather than remembered at each call site. A
 * measure in the wrong colour reads as a broken border rather than as a mark.
 *
 * Decorative: it carries no information a screen reader needs, so it is hidden
 * from the accessibility tree.
 */
export function Measure({
  width = "w-32",
  tone = "brass",
  className = "",
}: {
  /** Tailwind width class. Short by default — it is a mark, not a divider. */
  width?: string;
  tone?: "brass" | "current";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`${tone === "brass" ? "text-brass" : ""} ${className}`}
    >
      <div className={`measure ${width}`} />
    </div>
  );
}
