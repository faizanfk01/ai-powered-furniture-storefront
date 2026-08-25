import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import type { ApiErrorBody } from "@/lib/api";

/**
 * Route protection for the admin surface.
 *
 * NOTE ON THE FILENAME: this is `proxy.ts`, not `middleware.ts`. Next 16
 * deprecated the `middleware` file convention and renamed it to `proxy`, with
 * the exported function renamed to match. A `middleware.ts` here would be the
 * old convention. (`npx @next/codemod@canary middleware-to-proxy .` migrates
 * an existing one.)
 *
 * This instance is built from authConfig alone — no providers, so no Prisma
 * and no bcryptjs. It can verify a session JWT, which is all that is needed
 * to answer "is this caller signed in"; it cannot mint one, which is the
 * sign-in endpoint's job and deliberately not reachable from here.
 */
const { auth } = NextAuth(authConfig);

export const proxy = auth((request) => {
  if (request.auth?.user) return NextResponse.next();

  // An API caller wants a status code it can branch on; a browser wants to be
  // sent somewhere it can do something about it. Same rejection, two audiences.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  // So the login page can return the admin to where they were headed.
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  /**
   * Only the admin surface. Everything else — the storefront, the public
   * product/category reads, and critically /api/auth/* itself — is untouched:
   * running this over the sign-in endpoint would make logging in impossible.
   *
   * Mutating routes that do NOT sit under an admin prefix (POST/PATCH/DELETE
   * on /api/products and /api/categories) cannot be covered by a path matcher,
   * because their public GET shares the same path. Those are guarded per
   * method by requireAdmin() in lib/api.ts.
   */
  matcher: ["/api/admin/:path*", "/admin/:path*"],
};
