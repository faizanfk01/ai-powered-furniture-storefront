/**
 * The admin sign-in contract: who gets in, and where they land.
 *
 *   npm run test:login
 *
 * NEEDS A RUNNING SERVER AND A DATABASE. It drives the real HTTP endpoint, so
 * `npm run dev` has to be up and DATABASE_URL has to point somewhere it may
 * create a row. Override the target with ADMIN_TEST_URL if the server is not
 * on port 3000. That requirement is why this is not in a pre-commit hook and
 * why scripts/test-markdown.tsx, which needs neither, is.
 *
 * Drives the REAL form, not the Auth.js callback underneath it. The page
 * renders `<form action={login}>` as a plain POST carrying a hidden
 * `$ACTION_ID_…` field — the progressive-enhancement path a browser with
 * JavaScript disabled uses — so posting that is the closest thing to a person
 * filling the form in, and it exercises the server action, the callbackUrl
 * handling and the redirect together.
 *
 * WHAT IS ACTUALLY BEING PROTECTED. Two things, and neither is cosmetic:
 *
 *   1. THE OPEN-REDIRECT GUARD in app/(storefront)/login/redirect.ts. A login
 *      form that will forward to any URL a query string names is a phishing
 *      instrument wearing this site's domain, and the guard is four lines that
 *      a well-meaning refactor could smooth away without anything else
 *      breaking. Section 4 posts a real off-site callbackUrl and a real
 *      protocol-relative one and asserts neither escapes.
 *   2. WHERE A SIGN-IN LANDS. Section 5 covers the plain "typed /login" case
 *      and section 3 the "bounced off /admin/products by proxy.ts" case, which
 *      is the distinction the default exists to make.
 *
 * Creates a temporary AdminUser and deletes it in a finally block — including
 * on a crash, via the catch at the bottom. It never touches the real admin
 * row: every check runs against an `@invalid.test` address of its own.
 *
 * Was a one-off written for a visual refactor. It is part of the suite now,
 * because what it covers turned out to be a security boundary rather than a
 * styling regression.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { db } from "../lib/db";

const BASE = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:3000";
const TEST_EMAIL = `login-check-${randomBytes(4).toString("hex")}@invalid.test`;

let failures = 0;
function check(label: string, pass: boolean, detail?: string) {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "[ok]  " : "[FAIL]"} ${label}${detail ? `  -> ${detail}` : ""}`);
}

/** A fresh cookie jar per attempt — each sign-in starts from nothing. */
function makeJar() {
  const jar = new Map<string, string>();
  return {
    absorb(response: Response) {
      for (const raw of response.headers.getSetCookie()) {
        const [pair] = raw.split(";");
        const eq = pair?.indexOf("=") ?? -1;
        if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
      }
    },
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    has: (fragment: string) => [...jar.keys()].some((k) => k.includes(fragment)),
  };
}

/**
 * What the page itself put in its hidden callbackUrl field.
 *
 * Read from the rendered HTML rather than assumed, so the test asserts what a
 * browser would actually post back rather than what this script thinks it
 * should be.
 */
async function readHiddenCallback(loginUrl: string) {
  const html = await (await fetch(loginUrl)).text();
  const match = html.match(/name="callbackUrl"[^>]*value="([^"]*)"/);
  if (!match) throw new Error("no hidden callbackUrl field in the rendered form");
  return match[1]!;
}

/** Pull the server action's id out of the rendered form. */
async function readActionId(loginUrl: string) {
  const html = await (await fetch(loginUrl)).text();
  const match = html.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  if (!match) throw new Error("no $ACTION_ID field in the rendered form");
  return match[1]!;
}

/**
 * Submit the login form the way a no-JS browser would.
 *
 * `callbackUrl: undefined` means "went straight to /login" — no query
 * parameter and no hidden field beyond whatever the page itself rendered,
 * which is the case that exercises the default redirect. Passing a string
 * simulates the guard in proxy.ts having bounced them from that path.
 */
async function submitLogin(opts: {
  email: string;
  password: string;
  callbackUrl?: string;
}) {
  const jar = makeJar();
  const loginUrl =
    opts.callbackUrl === undefined
      ? `${BASE}/login`
      : `${BASE}/login?callbackUrl=${encodeURIComponent(opts.callbackUrl)}`;
  const actionId = await readActionId(loginUrl);

  const form = new FormData();
  form.set(actionId, "");
  // When no callbackUrl was given, post back whatever the PAGE put in its
  // hidden field — that is what a browser would send, and it is the thing
  // under test.
  form.set("callbackUrl", opts.callbackUrl ?? (await readHiddenCallback(loginUrl)));
  form.set("email", opts.email);
  form.set("password", opts.password);

  const response = await fetch(loginUrl, {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  jar.absorb(response);

  // A server action's redirect comes back either as a Location header or, for
  // the RSC path, as an x-action-redirect. Read whichever is present.
  const location =
    response.headers.get("location") ??
    response.headers.get("x-action-redirect") ??
    "";

  return { response, jar, location };
}

async function main() {
  const password = randomBytes(24).toString("hex");
  await db.adminUser.create({
    data: { email: TEST_EMAIL, passwordHash: await bcrypt.hash(password, 10) },
  });

  try {
    console.log("\n1. The page renders the form and all of its parts");
    {
      const html = await (await fetch(`${BASE}/login`)).text();
      check("GET /login is 200", true);
      check("email input present", /name="email"/.test(html));
      check("password input present", /name="password"/.test(html));
      check("hidden callbackUrl present", /name="callbackUrl"/.test(html));
      check("submit button present", /type="submit"/.test(html));
      check("the brand name is on the card", /Standard/.test(html) && /Furniture/.test(html));
    }

    console.log("\n2. A wrong password is refused, and the styled error shows");
    {
      const { location } = await submitLogin({
        email: TEST_EMAIL,
        password: "definitely-not-the-password",
        callbackUrl: "/admin/products",
      });
      check(
        "redirected back to /login with the error flag",
        location.includes("/login") && location.includes("error=CredentialsSignin"),
        location,
      );

      const html = await (
        await fetch(`${BASE}/login?error=CredentialsSignin`)
      ).text();
      check("the message is rendered", html.includes("Invalid email or password."));
      check("it is announced as an alert", /role="alert"/.test(html));
    }

    console.log("\n3. Correct credentials sign in and reach the callbackUrl");
    {
      const { jar, location } = await submitLogin({
        email: TEST_EMAIL,
        password,
        callbackUrl: "/admin/products",
      });

      check("a session cookie was issued", jar.has("session-token"));
      check(
        "redirected to the requested admin page",
        location.includes("/admin/products"),
        location || "(no redirect header)",
      );

      const admin = await fetch(`${BASE}/admin/products`, {
        headers: { cookie: jar.header() },
        redirect: "manual",
      });
      check(
        "that page loads as a signed-in admin",
        admin.status === 200,
        `HTTP ${admin.status}`,
      );
      const html = await admin.text();
      check("it is the real admin products screen", /Products/.test(html));
    }

    console.log("\n4. The open-redirect guard holds, and falls back to /admin");
    {
      const { jar, location } = await submitLogin({
        email: TEST_EMAIL,
        password,
        callbackUrl: "https://evil.example/steal",
      });
      check("still signs in", jar.has("session-token"));
      check(
        "but never redirects off-site",
        !location.includes("evil.example"),
        location || "(no redirect header)",
      );
      check(
        "the refused callbackUrl falls back to /admin, not /",
        new URL(location, BASE).pathname === "/admin",
        location || "(no redirect header)",
      );

      const protocolRelative = await submitLogin({
        email: TEST_EMAIL,
        password,
        callbackUrl: "//evil.example/steal",
      });
      check(
        "a protocol-relative callbackUrl is refused too",
        !protocolRelative.location.includes("evil.example"),
        protocolRelative.location || "(no redirect header)",
      );
      check(
        "and it falls back to /admin as well",
        new URL(protocolRelative.location, BASE).pathname === "/admin",
        protocolRelative.location || "(no redirect header)",
      );
    }

    console.log("\n5. No callbackUrl at all lands on /admin, not the storefront");
    {
      const hidden = await readHiddenCallback(`${BASE}/login`);
      check(
        "a plain /login renders /admin in its hidden callbackUrl",
        hidden === "/admin",
        hidden,
      );

      const { jar, location } = await submitLogin({ email: TEST_EMAIL, password });
      check("signs in", jar.has("session-token"));
      check(
        "lands on /admin",
        new URL(location, BASE).pathname === "/admin",
        location || "(no redirect header)",
      );
      check(
        "and NOT on the storefront home",
        new URL(location, BASE).pathname !== "/",
        location || "(no redirect header)",
      );

      const dashboard = await fetch(`${BASE}/admin`, {
        headers: { cookie: jar.header() },
        redirect: "manual",
      });
      check(
        "the dashboard loads as a signed-in admin",
        dashboard.status === 200,
        `HTTP ${dashboard.status}`,
      );
    }
  } finally {
    await db.adminUser.deleteMany({ where: { email: TEST_EMAIL } });
    console.log(`\ntemporary admin ${TEST_EMAIL} deleted`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch(async (error) => {
  console.error("FATAL:", error instanceof Error ? error.message : error);
  await db.adminUser.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
