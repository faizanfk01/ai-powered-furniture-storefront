import type { Metadata } from "next";
import Link from "next/link";

import { AdminPage } from "@/components/admin/admin-page";
import { ReviewActions } from "@/components/admin/review-actions";
import { db } from "@/lib/db";
import { productPath } from "@/lib/url";

export const metadata: Metadata = {
  title: "Reviews",
};

/**
 * Review moderation.
 *
 * PENDING by default, because this screen exists to clear a queue rather than
 * to browse an archive — the reviews nobody has read yet are the only ones
 * that need a decision.
 *
 * The tab lives in the URL rather than in component state, for the same reason
 * the catalogue filters do: the back button works, and "look at the approved
 * ones" is a link somebody can be sent.
 *
 * Reads the database directly (Server Component, behind the proxy.ts guard);
 * the actions go through /api/admin/reviews, which is where moderation is
 * already implemented and tested.
 */

const TABS = [
  { status: "PENDING", label: "Pending", href: "/admin/reviews" },
  {
    status: "APPROVED",
    label: "Approved",
    href: "/admin/reviews?status=approved",
  },
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-PK", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AdminReviewsPage({
  searchParams,
}: PageProps<"/admin/reviews">) {
  const params = await searchParams;
  const raw = Array.isArray(params.status) ? params.status[0] : params.status;

  // Anything unrecognised falls back to the queue. A mistyped tab in a URL
  // should show the work waiting, not an error.
  const status = raw?.toLowerCase() === "approved" ? "APPROVED" : "PENDING";

  const [reviews, pendingCount, approvedCount] = await Promise.all([
    db.review.findMany({
      where: { status },
      include: { product: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.review.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "APPROVED" } }),
  ]);

  const counts = { PENDING: pendingCount, APPROVED: approvedCount };
  const noReviewsAtAll = pendingCount === 0 && approvedCount === 0;

  return (
    <AdminPage
      title="Reviews"
      description={
        noReviewsAtAll
          ? "No reviews have been submitted yet."
          : `${pendingCount} awaiting moderation, ${approvedCount} published.`
      }
    >
      <nav aria-label="Review status" className="border-b border-hairline">
        <ul className="flex gap-6">
          {TABS.map((tab) => {
            const active = tab.status === status;
            return (
              <li key={tab.status}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-block border-b-2 px-1 pb-3 text-sm transition-colors ${
                    active
                      ? "border-brass font-medium text-ink"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 font-mono text-xs text-muted">
                    {counts[tab.status]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {reviews.length === 0 ? (
        <div className="mt-8 border border-hairline p-8">
          <h2 className="display-wide text-lg font-medium uppercase">
            {noReviewsAtAll
              ? "No reviews yet"
              : status === "PENDING"
                ? "Nothing to moderate"
                : "Nothing published yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            {noReviewsAtAll
              ? "Reviews submitted from the storefront arrive here for approval before anyone else can see them."
              : status === "PENDING"
                ? "Every submitted review has been dealt with. New ones appear here for approval before they reach the storefront."
                : "Nothing has been approved yet, so the storefront is showing no reviews. Approved reviews appear on the home page and on their product."}
          </p>
          {status === "APPROVED" && pendingCount > 0 && (
            <Link
              href="/admin/reviews"
              className="mt-5 inline-block text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
            >
              {pendingCount} waiting in the queue →
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-px bg-hairline">
          {reviews.map((review) => (
            <li key={review.id} className="bg-paper p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <span className="font-medium text-ink">
                    {review.authorName}
                  </span>
                  <span className="ml-3 font-mono text-sm text-brass">
                    {review.rating}/5
                  </span>
                </div>

                <span className="spec-label text-muted">
                  {dateFormatter.format(review.createdAt)}
                </span>
              </div>

              {/* What it is about. A general store review is not an orphan —
                  it is the kind that carries the home page's testimonial. */}
              <p className="mt-1 text-sm text-muted">
                {review.product ? (
                  <>
                    on{" "}
                    <Link
                      href={productPath(review.product.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
                    >
                      {review.product.name} ↗
                    </Link>
                  </>
                ) : (
                  "General store review"
                )}
              </p>

              <p className="mt-3 leading-relaxed whitespace-pre-line text-ink">
                {review.body}
              </p>

              <div className="mt-4">
                <ReviewActions
                  reviewId={review.id}
                  authorName={review.authorName}
                  status={review.status}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
