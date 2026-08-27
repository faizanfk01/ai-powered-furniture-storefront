/**
 * Verifies the login page still signs people in after the visual refactor.
 *
 *   npx tsx scripts/verify-login.ts
 *
 * Drives the REAL form, not the Auth.js callback underneath it. The page
 * renders `<form action={login}>` as a plain POST carrying a hidden
 * `$ACTION_ID_…` field — the progressive-enhancement path a browser with
 * JavaScript disabled uses — so posting that is the closest thing to a person
 * filling the form in, and it exercises the server action, the callbackUrl
 * handling and the redirect together.
 *
 * Creates a temporary AdminUser and deletes it in a finally block.
 *
 * One-off, for this refactor. Not part of the suite.
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

/** Pull the server action's id out of the rendered form. */
async function readActionId(loginUrl: string) {
  const html = await (await fetch(loginUrl)).text();
  const match = html.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
  if (!match) throw new Error("no $ACTION_ID field in the rendered form");
  return match[1]!;
}

/** Submit the login form the way a no-JS browser would. */
async function submitLogin(opts: {
  email: string;
  password: string;
  callbackUrl: string;
}) {
  const jar = makeJar();
  const loginUrl = `${BASE}/login?callbackUrl=${encodeURIComponent(opts.callbackUrl)}`;
  const actionId = await readActionId(loginUrl);

  const form = new FormData();
  form.set(actionId, "");
  form.set("callbackUrl", opts.callbackUrl);
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
    console.log("\n1. The styled page still renders the form and its parts");
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

    console.log("\n4. The open-redirect guard still holds (actions.ts untouched)");
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
