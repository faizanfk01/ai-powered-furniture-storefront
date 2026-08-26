import Link from "next/link";

import { productPath } from "@/lib/url";

/**
 * Rating, as five marks.
 *
 * Stars rather than something cleverer: this is the one place on the site
 * where an unfamiliar symbol would cost comprehension, and a rating nobody
 * can read instantly is worth nothing. Brass for the earned ones, hairline
 * for the rest, and the real value in text for anyone not looking at it.
 */
function Rating({ value }: { value: number }) {
  return (
    <p className="flex items-center gap-1">
      <span className="sr-only">{value} out of 5</span>
      {[1, 2, 3, 4, 5].map((mark) => (
        <svg
          key={mark}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`size-3.5 ${mark <= value ? "fill-brass" : "fill-hairline"}`}
        >
          <path d="M12 2.5l2.9 6.06 6.6.9-4.8 4.6 1.2 6.56L12 17.5l-5.9 3.12 1.2-6.56-4.8-4.6 6.6-.9z" />
        </svg>
      ))}
    </p>
  );
}

export type TestimonialReview = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  product: { name: string; slug: string } | null;
};

/**
 * One customer's words.
 *
 * A review about a specific piece keeps its attribution and links to it —
 * that is what makes it evidence rather than a floating compliment, and it
 * sends a reader who was persuaded straight to the thing that persuaded them.
 */
export function Testimonial({
  review,
  featured = false,
}: {
  review: TestimonialReview;
  /** The single-review layout: one large pull quote instead of a grid cell. */
  featured?: boolean;
}) {
  return (
    <figure className="flex h-full flex-col border-t border-hairline pt-6">
      <Rating value={review.rating} />

      <blockquote
        className={`mt-4 leading-relaxed text-ink ${
          featured ? "text-xl sm:text-2xl sm:leading-relaxed" : "text-lg"
        }`}
      >
        {review.body}
      </blockquote>

      <figcaption className="mt-auto pt-6">
        <span className="spec-label text-ink">{review.authorName}</span>
        {review.product ? (
          <span className="mt-1 block text-sm text-muted">
            on{" "}
            <Link
              href={productPath(review.product.slug)}
              className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
            >
              {review.product.name}
            </Link>
          </span>
        ) : (
          <span className="mt-1 block text-sm text-muted">
            on the showroom
          </span>
        )}
      </figcaption>
    </figure>
  );
}
