import type { Metadata } from "next";
import Link from "next/link";

import { AdminPage } from "@/components/admin/admin-page";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The admin landing page.
 *
 * Counts, and the one number that is a to-do rather than a statistic.
 *
 * Reads the database directly. That is fine here for the same reason it is
 * fine on the storefront — this is a Server Component — with one addition:
 * everything under /admin is behind the proxy.ts guard, so there is no
 * unauthenticated path to these numbers.
 */
export default async function AdminDashboardPage() {
  // One round trip for all five, rather than five sequential awaits.
  const [products, categories, images, pendingReviews, approvedReviews] =
    await Promise.all([
      db.product.count(),
      db.category.count(),
      db.productImage.count(),
      db.review.count({ where: { status: "PENDING" } }),
      db.review.count({ where: { status: "APPROVED" } }),
    ]);

  // Products with no photograph still render on the storefront — they fall
  // back to the footprint plan — but it is the thing most worth fixing, so
  // the dashboard says how many there are rather than leaving it to be
  // discovered one product page at a time.
  const withoutImages = await db.product.count({
    where: { images: { none: {} } },
  });

  return (
    <AdminPage
      title="Dashboard"
      description="What is in the catalogue right now."
    >
      <div className="grid grid-cols-2 gap-px bg-hairline lg:grid-cols-4">
        <Stat label="Products" value={products} href="/admin/products" />
        <Stat label="Categories" value={categories} />
        <Stat label="Images" value={images} />
        <Stat label="Approved reviews" value={approvedReviews} />
      </div>

      {/* Things that need a decision, separated from things that are just
          counts. A number nobody has to act on and a number somebody does are
          different kinds of information and should not sit in the same row. */}
      <h2 className="mt-10 spec-label text-muted">Needs attention</h2>
      <div className="mt-3 grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
        <Attention
          label="Reviews awaiting moderation"
          value={pendingReviews}
          detail={
            pendingReviews === 0
              ? "Nothing waiting."
              : "Unapproved reviews are not shown on the storefront."
          }
        />
        <Attention
          label="Products with no photograph"
          value={withoutImages}
          detail={
            withoutImages === 0
              ? "Every product has at least one image."
              : "These fall back to a dimensions plan on the storefront."
          }
        />
      </div>
    </AdminPage>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const body = (
    <>
      <p className="spec-label text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl text-ink">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-paper p-5 transition-colors hover:bg-hairline/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brass"
      >
        {body}
      </Link>
    );
  }

  return <div className="bg-paper p-5">{body}</div>;
}

function Attention({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  const clear = value === 0;

  return (
    <div className="bg-paper p-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="spec-label text-muted">{label}</p>
        {/* Brass only when there is something to do. A zero styled as an alert
            trains the eye to ignore the colour. */}
        <p
          className={`font-mono text-2xl ${clear ? "text-muted/50" : "text-brass"}`}
        >
          {value}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </div>
  );
}
