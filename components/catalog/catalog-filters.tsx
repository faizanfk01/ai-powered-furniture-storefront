"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { PRICE_BANDS, type CatalogParams } from "@/lib/catalog-filters";

type CategoryOption = { slug: string; name: string };

/**
 * The filter controls.
 *
 * A real <form method="get"> pointed at /catalog, so the whole thing works
 * with JavaScript switched off or still loading: change a select, press the
 * button that only exists inside <noscript>, and the browser navigates to the
 * filtered URL on its own. With JS, changes apply immediately and the button
 * is never rendered.
 *
 * That is not ceremony. This is a shop in Mardan whose customers are on phones
 * and mobile data; the catalogue should not be a blank page while a bundle
 * downloads.
 *
 * Everything below writes to the URL and reads nothing back — the server owns
 * the results. The only local state is the text in the search box, which needs
 * to stay responsive between keystrokes.
 */
export function CatalogFilters({
  categories,
  params,
  resultCount,
}: {
  categories: CategoryOption[];
  params: CatalogParams;
  resultCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // The input is uncontrolled by the URL between keystrokes: typing must not
  // wait for a round trip.
  const [query, setQuery] = useState(params.q ?? "");
  const formRef = useRef<HTMLFormElement>(null);

  // Keep the box in step when the URL changes from outside it — the back
  // button, or the "clear filters" link in the empty state.
  const [renderedQ, setRenderedQ] = useState(params.q ?? "");
  if (renderedQ !== (params.q ?? "")) {
    setRenderedQ(params.q ?? "");
    setQuery(params.q ?? "");
  }

  function navigate(next: CatalogParams, { replace = false } = {}) {
    const search = new URLSearchParams();
    if (next.q) search.set("q", next.q);
    if (next.category) search.set("category", next.category);
    if (next.price) search.set("price", next.price);

    const url = search.toString() ? `/catalog?${search}` : "/catalog";

    startTransition(() => {
      // scroll: false — changing a filter should not throw you back to the top
      // of the page you were reading.
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  }

  // Debounce the search box. Every keystroke is a database query otherwise,
  // and the history stack fills with one entry per letter — `replace` keeps
  // the back button meaning "the filter before this one".
  useEffect(() => {
    const current = params.q ?? "";
    if (query === current) return;

    const timer = setTimeout(() => {
      navigate({ ...params, q: query || undefined }, { replace: true });
    }, 250);

    return () => clearTimeout(timer);
    // `params` is the URL's current state; re-running when it changes is how
    // the debounce cancels itself after the navigation lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, params.q]);

  const controlClass =
    "w-full border border-hairline bg-paper px-4 py-3 font-body text-ink " +
    "focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

  return (
    <form
      ref={formRef}
      action="/catalog"
      method="get"
      className="border-y border-hairline py-6"
      // With JS the submit is redundant, but Enter in the text field still
      // fires it — send it through the router instead of a full page load.
      onSubmit={(event) => {
        event.preventDefault();
        navigate({ ...params, q: query || undefined }, { replace: true });
      }}
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <div>
          <label htmlFor="catalog-q" className="spec-label block text-muted">
            Search
          </label>
          <input
            id="catalog-q"
            name="q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sofa, sheesham, office…"
            className={`${controlClass} mt-2`}
          />
        </div>

        <div>
          <label
            htmlFor="catalog-category"
            className="spec-label block text-muted"
          >
            Category
          </label>
          <select
            id="catalog-category"
            name="category"
            value={params.category ?? ""}
            onChange={(event) =>
              navigate({ ...params, category: event.target.value || undefined })
            }
            className={`${controlClass} mt-2`}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="catalog-price" className="spec-label block text-muted">
            Price
          </label>
          <select
            id="catalog-price"
            name="price"
            value={params.price ?? ""}
            onChange={(event) =>
              navigate({
                ...params,
                price: (event.target.value ||
                  undefined) as CatalogParams["price"],
              })
            }
            className={`${controlClass} mt-2`}
          >
            <option value="">Any price</option>
            {PRICE_BANDS.map((band) => (
              <option key={band.id} value={band.id}>
                {band.label}
              </option>
            ))}
          </select>
        </div>

        <noscript>
          <button
            type="submit"
            className="mt-2 w-full bg-ink px-6 py-3 font-display text-sm font-medium tracking-wide text-paper uppercase"
          >
            Apply
          </button>
        </noscript>
      </div>

      {/* The count is the feedback that a filter did something. aria-live so a
          screen reader hears the result change without moving focus. */}
      <p
        aria-live="polite"
        className={`spec-label mt-5 transition-opacity ${
          isPending ? "text-muted opacity-50" : "text-muted"
        }`}
      >
        {isPending
          ? "Searching…"
          : `${resultCount} ${resultCount === 1 ? "piece" : "pieces"}`}
      </p>
    </form>
  );
}
