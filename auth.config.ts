import type { NextAuthConfig } from "next-auth";

/**
 * The half of the Auth.js config that needs no database.
 *
 * Split out so `proxy.ts` can build an auth instance that only *verifies* an
 * existing session JWT. The Credentials provider lives in auth.ts because it
 * needs Prisma and bcryptjs; importing that module into the proxy would
 * instantiate a PrismaClient (and its pg Pool) on a code path that never
 * queries the database.
 *
 * Next 16 runs Proxy on the Node.js runtime, so those imports would not
 * *fail* there as they did under the old Edge default — but the proxy docs
 * are explicit that it "should not attempt relying on shared modules", and
 * loading a connection pool to read a cookie is waste either way.
 *
 * The callbacks belong here rather than in auth.ts so both instances decode a
 * token identically.
 */
export const authConfig = {
  // Credentials can only issue a JWT — Auth.js does not support database
  // sessions for it, and schema.prisma has no Session table.
  //
  // maxAge is set rather than left to Auth.js, whose default is 30 days. With
  // no Session table there is nothing to revoke against: a token stays valid
  // until it expires, so its lifetime IS the exposure window for a copied
  // cookie — and signing out or rotating the password does not shorten it.
  // Seven days, in seconds.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  pages: { signIn: "/login" },

  // Filled in by auth.ts. An auth instance with no providers can still verify
  // a token; it just cannot create one.
  providers: [],

  callbacks: {
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
