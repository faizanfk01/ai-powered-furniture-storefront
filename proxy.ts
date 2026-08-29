import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import type { ApiErrorBody } from "@/lib/api";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

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

/**
 * The endpoint that actually checks a password.
 *
 * The login form posts to a Server Function, which rate limits before it calls
 * signIn() — but signIn() reaches Auth.js IN PROCESS, so that check protects
 * the form and nothing else. This URL is reachable directly over HTTP with
 * only a CSRF token from /api/auth/csrf, and an attacker uses it rather than
 * the form. Verified before this was added: twelve consecutive guesses, none
 * refused.
 *
 * So the limit has to sit here as well as in the action. Same "login" bucket,
 * same key, so the two paths share one budget instead of granting two.
 */
const CREDENTIALS_CALLBACK = "/api/auth/callback/credentials";

export const proxy = auth(async (request) => {
  // RATE LIMIT ONLY — deliberately before, and separate from, the guard below.
  // This path must stay reachable to anonymous callers or nobody could ever
  // sign in, so it returns early and never reaches the "is this caller signed
  // in" test. Nothing about the existing guard changes.
  if (request.nextUrl.pathname === CREDENTIALS_CALLBACK) {
    const verdict = await checkRateLimit("login", clientIp(request.headers));

    if (!verdict.allowed) {
      console.warn(
        `[auth] credentials callback rate limit reached for ${clientIp(request.headers)}` +
          (verdict.degraded ? " (degraded — Redis unavailable, in-process backstop)" : ""),
      );
      // The same destination this endpoint sends a wrong password to, with the
      // code the login page renders as "too many attempts". A caller driving
      // it directly gets the answer a browser would.
      const loginUrl = new URL("/login", request.nextUrl.origin);
      loginUrl.searchParams.set("error", "RateLimited");
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("retry-after", String(verdict.retryAfterSeconds));
      return response;
    }

    return NextResponse.next();
  }

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
   * The admin surface, plus one auth endpoint for THROTTLING ONLY.
   *
   * The rest of /api/auth/* is still untouched, and still deliberately so:
   * running the sign-in guard over the sign-in endpoints would make logging in
   * impossible. The credentials callback is listed here because the handler
   * gives it a rate-limit branch that returns before the guard — it is matched
   * so it can be counted, never so it can be blocked for being anonymous.
   *
   * Mutating routes that do NOT sit under an admin prefix (POST/PATCH/DELETE
   * on /api/products and /api/categories) cannot be covered by a path matcher,
   * because their public GET shares the same path. Those are guarded per
   * method by requireAdmin() in lib/api.ts.
   */
  matcher: ["/api/admin/:path*", "/admin/:path*", "/api/auth/callback/credentials"],
};
