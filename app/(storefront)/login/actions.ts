"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

import { DEFAULT_AFTER_LOGIN, safeCallbackUrl } from "./redirect";

/**
 * The login and logout server actions.
 *
 * Everything a `"use server"` module exports becomes a callable server action,
 * so it may only export async functions. The redirect policy — the default
 * landing page and the open-redirect guard — therefore lives beside this file
 * in ./redirect.ts, where the login page can import the same default for its
 * hidden field.
 */

/**
 * Send the admin back to the form with an error, keeping the callbackUrl they
 * were carrying. Extracted because the rate-limit rejection and the bad-
 * credentials rejection have to behave identically apart from the code — two
 * copies of this would be two chances for them to drift into telling an
 * attacker which one they hit.
 */
function backToLogin(code: "CredentialsSignin" | "RateLimited", callbackUrl: string) {
  const params = new URLSearchParams({ error: code });
  // Omitted when it is only the default, which keeps ?callbackUrl=/admin out
  // of the address bar for the ordinary "typed /login, fat-fingered the
  // password" case.
  if (callbackUrl !== DEFAULT_AFTER_LOGIN) params.set("callbackUrl", callbackUrl);
  redirect(`/login?${params}`);
}

export async function login(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  // BEFORE signIn, so a blocked attempt never reaches the database lookup or
  // the bcrypt comparison — the two things a brute-force run is paying for.
  //
  // KEYED ON IP ALONE. Not on the submitted email, and that is the security
  // property: a per-email counter would answer "is this address rate limited"
  // differently for a real account than for one that does not exist, which
  // rebuilds the enumeration oracle that DUMMY_HASH in auth.ts exists to close.
  // The limiter never sees the email, so it cannot leak it.
  //
  // Server Functions are POSTs to the route they are used on, so this is the
  // /login POST — headers() reads that request.
  const ip = clientIp(await headers());
  const verdict = await checkRateLimit("login", ip);

  if (!verdict.allowed) {
    console.warn(
      `[auth] login rate limit reached for ${ip}` +
        (verdict.degraded ? " (degraded — Redis unavailable, in-process backstop)" : ""),
    );
    backToLogin("RateLimited", callbackUrl);
  }

  try {
    // Credentials are read and validated in authorize() — see auth.ts. Nothing
    // here inspects the password, so nothing here can leak it into a log.
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: callbackUrl,
    });
  } catch (error) {
    // On success signIn performs the redirect by throwing NEXT_REDIRECT. That
    // is not an AuthError, so it falls through to the rethrow below — catching
    // it here would silently swallow the successful navigation.
    if (error instanceof AuthError) {
      // Carried across a failed attempt so a second try still returns the
      // admin to the page they were bounced from.
      backToLogin("CredentialsSignin", callbackUrl);
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
