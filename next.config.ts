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

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2RemotePattern(),
  },
};

export default nextConfig;
