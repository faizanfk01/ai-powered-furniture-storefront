import type { Metadata } from "next";
import Link from "next/link";

import { logout } from "@/app/(storefront)/login/actions";
import { AdminNavLink } from "@/components/admin/admin-nav";
import { auth } from "@/auth";

/**
 * Overrides the storefront metadata inherited from the root layout — admin
 * pages were otherwise describing themselves to the world as a furniture
 * showroom in Shen Gul Plaza.
 *
 * `noindex, nofollow` is belt and braces. proxy.ts already means a crawler
 * gets a redirect to /login rather than a page, so there is nothing here to
 * index; this costs one header and covers the day somebody widens the matcher.
 */
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin" },
  description: "Catalogue administration for Standard Furniture.",
  robots: { index: false, follow: false },
};

/**
 * The admin shell.
 *
 * DELIBERATELY NOT THE STOREFRONT. No measure marks, no footprint plans, no
 * editorial spacing — those exist to sell furniture, and this is the tool the
 * owner uses to type prices into. It keeps the palette and the three type
 * faces so it is recognisably the same product, and drops everything whose job
 * was atmosphere.
 *
 * The concrete differences: a fixed dark sidebar instead of a sticky
 * translucent header, small type and tight rows instead of generous leading,
 * and a full-width content column instead of a centred max-w-6xl measure —
 * a table of twelve products should use the monitor it is being read on.
 *
 * AUTH: proxy.ts already gates /admin/:path*, so an unauthenticated request
 * never reaches this file. `auth()` is called anyway, because the shell needs
 * the signed-in identity to display — and reading it here means the sidebar
 * cannot render for a session that does not exist.
 */
export default async function AdminLayout({ children }: LayoutProps<"/"> ) {
  const session = await auth();

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Sidebar. Static — no collapse toggle, because the admin is used on a
          desktop and a hamburger would be one more thing to build and break.

          ON A PHONE IT IS A STRIP, WHICH IT WAS ONLY EVER CLAIMED TO BE.
          The rail is a column at every width in the markup, so below `lg` it
          stacked the brand, four nav rows, the signed-in address, a sign-out
          button and a back-link into 380px of dark chrome ABOVE the page — on
          a 700px phone, more than half the screen before the first product
          row. Nothing was wrong with the desktop rail; what was missing was a
          second arrangement of the same four blocks.

          It wraps into two short rows now: brand and sign-out on the first,
          the nav and the storefront link on the second. `order-*` is what puts
          the account block beside the brand without moving it in the DOM — it
          belongs after the nav for a screen reader and for the desktop rail,
          where it is deliberately the last thing and furthest from a
          mis-click. Every `order` is reset at lg, where source order is
          already the right order. */}
      <aside className="flex shrink-0 flex-wrap items-center border-b border-paper/10 bg-ink-deep text-paper lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-col lg:flex-nowrap lg:items-stretch lg:border-b-0">
        <div className="order-1 px-4 py-3 sm:px-5 lg:order-none lg:w-full lg:border-b lg:border-paper/10 lg:px-5 lg:py-4">
          <Link
            href="/admin"
            className="display-wide text-sm font-semibold tracking-[0.08em] uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Standard <span className="text-paper/60">Admin</span>
          </Link>
        </div>

        <nav
          aria-label="Admin"
          className="order-3 w-full border-t border-paper/10 px-2 py-1.5 lg:order-none lg:w-auto lg:flex-1 lg:border-t-0 lg:py-4"
        >
          {/* A scrolling row on a phone, the same column on a desktop. The row
              scrolls rather than wraps so the strip stays one line tall
              whatever gets added to it later. */}
          <ul className="flex flex-row gap-1 overflow-x-auto [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible">
            <li>
              <AdminNavLink href="/admin" label="Dashboard" exact />
            </li>
            <li>
              <AdminNavLink href="/admin/products" label="Products" />
            </li>
            <li>
              <AdminNavLink href="/admin/categories" label="Categories" />
            </li>
            <li>
              <AdminNavLink href="/admin/reviews" label="Reviews" />
            </li>
          </ul>
        </nav>

        {/* Who is signed in, and the way out. Pinned to the bottom of the
            sidebar on desktop: it is the least-used control here and should
            not sit where a mis-click can reach it. */}
        <div className="order-2 ml-auto px-4 py-3 sm:px-5 lg:order-none lg:ml-0 lg:w-full lg:border-t lg:border-paper/10 lg:px-5 lg:py-4">
          {/* Who it is stays on the desktop rail, where there is a column to
              put it in. On the phone strip the sign-out button is the only
              part that has to be reachable, and the address would push it off
              the row. */}
          <p className="spec-label hidden text-paper/40 lg:block">Signed in</p>
          <p className="mt-1 hidden truncate text-sm text-paper/80 lg:block">
            {session?.user?.email ?? "Unknown"}
          </p>

          {/* A form posting to the server action, not a link: signing out is a
              state change and must not be reachable by a prefetch or a GET. */}
          <form action={logout} className="lg:mt-3">
            <button
              type="submit"
              className="w-full border border-paper/25 px-3 py-2 font-display text-xs font-medium tracking-wide whitespace-nowrap text-paper/80 uppercase transition-colors hover:border-paper/60 hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="order-4 w-full border-t border-paper/10 px-4 py-2 sm:px-5 lg:order-none lg:px-5 lg:py-3">
          <Link
            href="/"
            className="text-xs text-paper/45 transition-colors hover:text-paper/80"
          >
            ← View the storefront
          </Link>
        </div>
      </aside>

      <main id="admin-main" className="min-w-0 flex-1 bg-paper">
        {children}
      </main>
    </div>
  );
}
