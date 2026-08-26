import { headers } from "next/headers";

/**
 * The site's own origin, at request time.
 *
 * Needed because the WhatsApp prefill has to carry an absolute link — the
 * message lands in someone else's chat app, where "/products/karachi-sofa"
 * means nothing.
 *
 * Prefers NEXT_PUBLIC_SITE_URL when it is set, so production has one canonical
 * origin regardless of which host header a proxy passes through. Falls back to
 * the incoming request, which is what makes this work on localhost and on a
 * preview deployment without any configuration.
 */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();

  // x-forwarded-* first: behind a proxy, `host` is the internal hostname.
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";

  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

/** An absolute URL for a path on this site. `path` should start with "/". */
export async function absoluteUrl(path: string) {
  return `${await siteOrigin()}${path}`;
}

/** Canonical path for a product. One definition, so links cannot drift. */
export function productPath(slug: string) {
  return `/products/${slug}`;
}
