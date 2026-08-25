import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { signInSchema } from "@/lib/validations";

/**
 * Auth.js (next-auth v5) configuration — single admin account.
 *
 * Lives at the project root by v5 convention: this module is the one place
 * that builds the auth instance, and `handlers` / `auth` / `signIn` /
 * `signOut` are imported from here everywhere else.
 *
 * AUTH_SECRET is read from the environment automatically by v5 (with
 * NEXTAUTH_SECRET as a v4 fallback) — it is deliberately not referenced here,
 * so the secret never appears in application code.
 */

/**
 * A wrong email and a wrong password must be indistinguishable to the caller,
 * in both the response and the time taken.
 *
 * If we returned early when no AdminUser matched, a missing account would
 * answer in a few milliseconds while a real account with a bad password would
 * take the ~250ms of a bcrypt comparison. That timing gap tells an attacker
 * which addresses exist. Comparing against this fixed hash burns the same
 * work for an unknown email as for a known one.
 *
 * Generated once at cost 12 from 32 random bytes that were discarded — not a
 * published example hash, so no plaintext for it exists anywhere. Verified to
 * cost the same 282ms as a real comparison rather than failing fast on a
 * malformed value. Safe to commit: it authenticates nothing, and `!admin`
 * rejects the request regardless of what `compare` returns.
 */
const DUMMY_HASH = "$2b$12$pklU7lrEjKVbWCtSKgv40e2owTByO65jkDJdL/0n3yVCLxaXKlNDm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Session strategy, the /login page and the token callbacks are shared with
  // proxy.ts — see auth.config.ts for why they live there.
  ...authConfig,

  providers: [
    Credentials({
      // Shapes the default Auth.js form; our own page posts the same names.
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const admin = await db.adminUser.findUnique({ where: { email } });

        // Always compare, even with no matching row — see DUMMY_HASH above.
        const passwordMatches = await bcrypt.compare(
          password,
          admin?.passwordHash ?? DUMMY_HASH,
        );

        if (!admin || !passwordMatches) return null;

        // Only what the session needs. The hash must never leave this function.
        return { id: admin.id, email: admin.email };
      },
    }),
  ],
});
