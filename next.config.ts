import type { NextConfig } from "next";

/**
 * Which remote hosts next/image is allowed to fetch and optimize.
 *
 * Derived from R2_PUBLIC_BASE_URL rather than hardcoded, so the bucket's
 * public host is configured in exactly one place — the same variable lib/r2.ts
 * builds image URLs from. Hardcoding it here would mean a bucket change breaks
 * images in a file nobody thinks to look at.
 *
 * Pinned to the one hostname, NOT `**.r2.dev`. A wildcard over that domain
 * would let anyone with any public R2 bucket run their images through our
 * optimizer at our expense, which is a bandwidth bill and an open proxy.
 */
function r2RemotePattern() {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim();

  if (!base) {
    // Not fatal: `next lint`, and a CI job that only typechecks, have no
    // reason to hold R2 credentials. It IS fatal to serving images, so say so
    // rather than failing later with an opaque next/image error.
    console.warn(
      "[next.config] R2_PUBLIC_BASE_URL is not set — next/image will reject R2 URLs.",
    );
    return [];
  }

  try {
    const { protocol, hostname } = new URL(base);
    return [
      {
        protocol: protocol.replace(":", "") as "https" | "http",
        hostname,
        pathname: "/**",
      },
    ];
  } catch {
    console.warn(
      `[next.config] R2_PUBLIC_BASE_URL is not a valid URL: ${base}`,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------

/** The origin of a URL-shaped env var, or null when unset or unparseable. */
function originOf(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * The Content-Security-Policy.
 *
 * Both R2 origins are DERIVED FROM THE ENVIRONMENT, not hardcoded — the same
 * reasoning as r2RemotePattern() above. They are two different hosts doing two
 * different jobs, and the policy needs both:
 *
 *   - R2_PUBLIC_BASE_URL (pub-*.r2.dev) serves the images. Everything on the
 *     storefront goes through next/image, which proxies via /_next/image on
 *     our own origin, so `self` would technically cover today's pages. It is
 *     listed anyway: the day one `<img>` or one `unoptimized` prop points
 *     straight at the bucket, a missing img-src is a blank product photo that
 *     nobody connects to a header set months earlier.
 *   - R2_ENDPOINT (*.r2.cloudflarestorage.com) is where the BROWSER PUTs an
 *     upload. This one is not optional: the admin image manager fetches the
 *     presigned URL cross-origin, and without it in connect-src every upload
 *     fails at the PUT with a CSP error and the presign step looks broken.
 *
 * WHAT IS LOOSENED, AND WHY — script-src and style-src both carry
 * 'unsafe-inline'.
 *
 * Next's App Router streams the RSC payload to the browser as a series of
 * inline `<script>self.__next_f.push(...)</script>` tags, and injects inline
 * styles. Neither carries a hash we can pin. The strict alternative is a
 * per-request nonce, which has to be generated in proxy.ts and threaded
 * through — and a nonce is by definition different on every request, so every
 * page becomes dynamically rendered. This site has genuinely static pages
 * (/about, /contact, /custom-orders prerender today); trading that for a
 * header that still has to allow every inline script Next emits is a bad deal
 * for a brochure site with one admin.
 *
 * So: 'unsafe-inline' on scripts and styles is a KNOWN, DELIBERATE gap. It
 * means CSP is not the thing standing between this app and an injected script
 * — React's escaping is, and there is no dangerouslySetInnerHTML anywhere in
 * the codebase (the chat markdown renderer builds React elements precisely so
 * that stays true). Everything else the policy does — no framing, no plugins,
 * no arbitrary connect targets, no <base> rewriting, no off-site form posts —
 * is fully enforced.
 *
 * `'unsafe-eval'` and `ws:` are DEVELOPMENT ONLY: Turbopack's hot reload needs
 * both, and neither reaches a production response.
 */
function contentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== "production";

  const imageOrigin = originOf(process.env.R2_PUBLIC_BASE_URL);
  const uploadOrigin = originOf(process.env.R2_ENDPOINT);

  if (!uploadOrigin) {
    // Not fatal — the same posture as a missing R2_PUBLIC_BASE_URL above. It
    // IS fatal to admin uploads, so say so rather than letting a CSP error in
    // the browser console be the first anyone hears of it.
    console.warn(
      "[next.config] R2_ENDPOINT is not set — CSP will block browser uploads to R2.",
    );
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // data: covers the inline SVGs Next and Tailwind emit.
    `img-src 'self' data:${imageOrigin ? ` ${imageOrigin}` : ""}`,
    // Inter is self-hosted by next/font at build time, so no Google origins.
    "font-src 'self'",
    `connect-src 'self'${uploadOrigin ? ` ${uploadOrigin}` : ""}${isDev ? " ws:" : ""}`,
    // The modern clickjacking control; X-Frame-Options below is its fallback.
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // The login POST and every other form target our own origin. WhatsApp,
    // Maps and the social links are <a href> navigations, which this does not
    // restrict.
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2RemotePattern(),
  },

  async headers() {
    const headers = [
      { key: "Content-Security-Policy", value: contentSecurityPolicy() },
      // Superseded by frame-ancestors in modern browsers, kept for the older
      // ones that never learned it. Both say the same thing.
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Full URL to our own pages, origin only to anyone else. The product
      // page a customer came from is not something wa.me needs to be told.
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ];

    // HSTS only in production. On http://localhost it does nothing useful and
    // a stray max-age pinned against a dev host is a nuisance to undo.
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
