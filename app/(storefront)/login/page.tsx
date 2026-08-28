import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/auth";
import { Wordmark } from "@/components/site/wordmark";
import { Button } from "@/components/ui/button";
import { controlClass, Field } from "@/components/ui/field";
import { Measure } from "@/components/ui/measure";

import { login, logout } from "./actions";
import { DEFAULT_AFTER_LOGIN } from "./redirect";

/**
 * Admin sign-in.
 *
 * Was deliberately unstyled while the auth loop was being built. This pass is
 * VISUAL ONLY — the plain `<form action={serverAction}>` is unchanged, there
 * is still no client component and no onSubmit, so it works with JavaScript
 * disabled and the browser never holds the password in client-side state. The
 * hidden callbackUrl, its sanitising in actions.ts, and the single
 * indistinguishable error message are all untouched.
 *
 * The card wears the ink band the chat panel and the admin sidebar use, so
 * signing in reads as stepping out of the showroom and into the tool. It sits
 * inside the storefront chrome because that is where the route lives; the
 * header and footer around it are the ordinary public ones.
 */

export const metadata: Metadata = {
  title: "Sign in",
  // A login form has nothing to offer a search engine, and an indexed admin
  // door is an invitation to try the handle.
  robots: { index: false, follow: false },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The card shell both states share, so they cannot drift apart. */
function AuthCard({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    // min-h is set against the header's own height variable rather than a
    // guessed number, so the card stays optically centred if the bar changes.
    <div className="flex min-h-[calc(100vh-var(--header-height,4.5rem)-1px)] items-center justify-center px-4 py-12 sm:py-16">
      <div className="w-full max-w-md border border-hairline bg-paper shadow-xl shadow-ink/5">
        <div className="bg-ink-deep px-6 py-7 text-paper sm:px-8">
          <Measure width="w-12" />
          <div className="mt-4">
            <Wordmark tone="paper" />
          </div>
          <p className="spec-label mt-3 text-paper/55">{caption}</p>
        </div>

        <div className="px-6 py-7 sm:px-8 sm:py-8">{children}</div>
      </div>
    </div>
  );
}

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const error = first(searchParams.error);
  // No ?callbackUrl means nobody was bounced here — they came to sign in and
  // get to work, so the hidden field carries the dashboard. When the guard in
  // proxy.ts DID bounce them, its callbackUrl wins and they return to the page
  // they were reaching for.
  //
  // Not sanitised here on purpose: this value only ever reaches an attribute,
  // where React escapes it, and the POST that carries it back is checked by
  // safeCallbackUrl() in actions.ts. One validation, at the boundary that
  // actually redirects.
  const callbackUrl = first(searchParams.callbackUrl) ?? DEFAULT_AFTER_LOGIN;

  const session = await auth();

  if (session?.user) {
    return (
      <AuthCard caption="Already signed in">
        <p className="leading-relaxed text-ink">
          Signed in as{" "}
          <span className="font-mono text-sm break-all">
            {session.user.email}
          </span>
          .
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button href="/admin" className="w-full">
            Go to the admin
          </Button>

          {/* The server action is untouched; only the button around it is. */}
          <form action={logout}>
            <Button type="submit" variant="outline" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard caption="Administrator sign in">
      {error ? (
        // One message for every failure mode. Distinguishing "no such account"
        // from "wrong password" would let anyone test which addresses exist.
        //
        // Brass, not red: this is the site's one warm mark and the colour every
        // other warning in the admin already uses. `role="alert"` is what
        // announces it — the colour is not carrying the meaning on its own.
        <p
          role="alert"
          className="mb-6 border border-brass/50 bg-brass/10 px-4 py-3 text-sm leading-relaxed text-ink"
        >
          Invalid email or password.
        </p>
      ) : null}

      <form action={login} className="space-y-5">
        {/* Carried through the POST so a redirect from /admin/* returns the
            admin to the page they were trying to reach. Sanitised in the
            action — see safeCallbackUrl. */}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            className={controlClass}
          />
        </Field>

        <Field id="password" label="Password">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={controlClass}
          />
        </Field>

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      <p className="mt-6 border-t border-hairline pt-5 text-sm text-muted">
        This is the staff entrance.{" "}
        <Link
          href="/"
          className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Back to the showroom
        </Link>
        .
      </p>
    </AuthCard>
  );
}
