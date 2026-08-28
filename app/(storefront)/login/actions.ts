"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";

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

export async function login(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

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
      const params = new URLSearchParams({ error: "CredentialsSignin" });
      // Carried across a failed attempt so a second try still returns the
      // admin to the page they were bounced from. Omitted when it is only the
      // default, which keeps ?callbackUrl=/admin out of the address bar for
      // the ordinary "typed /login, fat-fingered the password" case.
      if (callbackUrl !== DEFAULT_AFTER_LOGIN) {
        params.set("callbackUrl", callbackUrl);
      }
      redirect(`/login?${params}`);
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
