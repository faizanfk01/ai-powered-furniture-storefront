import { auth } from "@/auth";

import { login, logout } from "./actions";

/**
 * Admin sign-in. Deliberately unstyled — no theme, no branding, no Tailwind
 * classes. Phase 5 owns the visual design; this page exists so the auth loop
 * is usable and testable now.
 *
 * Plain <form action={serverAction}> with no client component and no
 * onSubmit, so it works with JavaScript disabled and the browser never holds
 * the password in client-side state.
 */

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const error = first(searchParams.error);
  const callbackUrl = first(searchParams.callbackUrl) ?? "/";

  const session = await auth();

  if (session?.user) {
    return (
      <main>
        <h1>Admin</h1>
        <p>Signed in as {session.user.email}</p>
        <form action={logout}>
          <button type="submit">Sign out</button>
        </form>
      </main>
    );
  }

  return (
    <main>
      <h1>Admin sign in</h1>

      {error ? (
        // One message for every failure mode. Distinguishing "no such account"
        // from "wrong password" would let anyone test which addresses exist.
        <p role="alert">Invalid email or password.</p>
      ) : null}

      <form action={login}>
        {/* Carried through the POST so a redirect from /admin/* returns the
            admin to the page they were trying to reach. Sanitised in the
            action — see safeCallbackUrl. */}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <p>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
        </p>

        <p>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </p>

        <p>
          <button type="submit">Sign in</button>
        </p>
      </form>
    </main>
  );
}
