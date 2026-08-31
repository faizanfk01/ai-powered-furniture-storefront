import type { ReactNode } from "react";

/**
 * The admin's page frame: a title bar and a content well.
 *
 * The admin equivalent of the storefront's <Section>, and pointedly smaller.
 * No measure, no eyebrow, no lede — a tool's page needs a name, sometimes an
 * action, and then the data. Padding is tight (py-6, not py-28) because
 * vertical space here is rows the owner can see without scrolling.
 */
export function AdminPage({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  /** Primary action for the page, e.g. "New product". */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
        <div>
          <h1 className="display-wide text-xl font-semibold uppercase sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
        {action}
      </header>

      <div className="pt-6">{children}</div>
    </div>
  );
}
