import type { ReactNode } from "react";

/**
 * The horizontal frame every page sits in.
 *
 * One measurement, defined once. The `wide` variant exists for the catalogue
 * grid, which needs a fourth column at large sizes to avoid cards that stretch
 * wider than the photographs they will eventually hold.
 */
export function Container({
  children,
  width = "default",
  className = "",
}: {
  children: ReactNode;
  width?: "default" | "wide";
  className?: string;
}) {
  const max = width === "wide" ? "max-w-7xl" : "max-w-6xl";

  return (
    <div className={`mx-auto w-full ${max} px-6 sm:px-10 ${className}`}>
      {children}
    </div>
  );
}
