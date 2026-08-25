/**
 * Auth.js endpoints: /api/auth/signin, /callback/credentials, /session,
 * /signout, /csrf. The handlers are built in auth.ts; this file only exposes
 * them at the route Auth.js expects (basePath defaults to /api/auth).
 *
 * Note this sits under /api/auth, NOT /api/admin — the sign-in endpoint has
 * to stay reachable to unauthenticated callers, or nobody could ever log in.
 */
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
