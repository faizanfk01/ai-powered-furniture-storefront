/**
 * Where a sign-in ends up, and the guard that decides it.
 *
 * ITS OWN MODULE, and not by preference. `actions.ts` carries `"use server"`,
 * which makes every export a callable server action and therefore allows only
 * async functions — exporting a plain string constant from it fails the build
 * with "Only async functions are allowed to be exported in a 'use server'
 * file". The login page needs the same default for the hidden field it
 * renders, so the value has to sit somewhere both can import from.
 *
 * That constraint produced the better arrangement anyway: the redirect policy
 * is now a pure function with no server-action wrapper around it, so it can be
 * read, reasoned about and tested on its own.
 */

/**
 * Where a successful sign-in lands when nothing better was asked for.
 *
 * The admin dashboard, not the storefront home. Only one account exists and
 * the only reason to use this form is to go and run the shop — somebody who
 * typed /login and arrived back on the public home page has been handed the
 * page they could already see, and has to find their way to /admin themselves.
 */
export const DEFAULT_AFTER_LOGIN = "/admin";

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
 *
 * THE GUARD IS UNCHANGED; ONLY WHAT IT FALLS BACK TO MOVED. Both rejections
 * below refuse exactly the input they always refused, and both still return a
 * same-site absolute path — the dashboard now, instead of the showroom. So a
 * refused off-site callbackUrl lands the admin somewhere useful rather than on
 * the public home page, which is what a plain visit to /login also gets.
 */
export function safeCallbackUrl(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return DEFAULT_AFTER_LOGIN;
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_AFTER_LOGIN;
  return value;
}
