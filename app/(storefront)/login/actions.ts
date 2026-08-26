"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";

/**
 * Where to send the admin after a successful sign-in.
 *
 * The value arrives from a query string via a hidden form field, so it is
 * attacker-controllable: `/login?callbackUrl=https://evil.example` would
 * otherwise turn our own login form into an open redirect that borrows this
 * site's credibility. Only same-site absolute paths are accepted.
 *
 * `//evil.example` is rejected explicitly — it starts with `/` but browsers
 * read it as a protocol-relative URL to another origin.
 */
function safeCallbackUrl(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

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
      if (callbackUrl !== "/") params.set("callbackUrl", callbackUrl);
      redirect(`/login?${params}`);
    }
    throw error;
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
