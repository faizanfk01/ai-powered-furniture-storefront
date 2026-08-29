/**
 * The two hardening boundaries: the admin review guard, and the response
 * headers.
 *
 *   npm run test:hardening
 *
 * NEEDS A RUNNING SERVER AND A DATABASE — `npm run dev` or `npm start`, on
 * port 3000 unless ADMIN_TEST_URL says otherwise. It adapts to which one:
 * the development CSP carries 'unsafe-eval' and ws: for Turbopack's hot
 * reload, and production carries neither plus HSTS, so the assertions below
 * branch on what the server actually reports rather than assuming.
 *
 * WHAT IS ACTUALLY BEING PROTECTED, because neither of these fails loudly:
 *
 *   1. THE CSP'S TWO R2 ORIGINS. They are different hosts doing different
 *      jobs and both are load-bearing: drop the public one from img-src and
 *      product photos vanish; drop the endpoint from connect-src and every
 *      admin upload dies at the PUT with a console error, while the presign
 *      step still returns 200 and looks fine. Neither shows up in a page that
 *      returns HTTP 200, which is why they are asserted here.
 *   2. THE ADMIN REVIEW ROUTES, from both sides — an admin can moderate, and
 *      anonymous cannot.
 *
 *      HONEST LIMIT, STATED SO NOBODY READS MORE INTO A GREEN RUN THAN IS
 *      THERE: this cannot tell which layer produced the 401. proxy.ts and
 *      requireAdmin() return byte-identical bodies — both are
 *      `{"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
 *      with status 401 — so from outside the process they are
 *      indistinguishable, and section 2 would keep passing if the in-handler
 *      guard were deleted tomorrow. Proving the second layer requires
 *      disabling the first, which is a source edit and does not belong in a
 *      script that runs against a live server. It was verified that way once,
 *      by hand, when the guard was added.
 *
 * Creates a temporary AdminUser and temporary Review rows and deletes both in
 * a finally block. It never touches the real admin row.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";

const BASE = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:3000";
const EMAIL = `harden-${randomBytes(4).toString("hex")}@invalid.test`;
const AUTHOR = `Harden ${randomBytes(4).toString("hex")}`;
const IP = () =>
  `198.51.${1 + Math.floor(Math.random() * 254)}.${1 + Math.floor(Math.random() * 254)}`;

let failures = 0;
const check = (label: string, pass: boolean, detail?: string) => {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "[ok]  " : "[FAIL]"} ${label}${detail ? `  -> ${detail}` : ""}`);
};

async function field(url: string, re: RegExp) {
  return (await (await fetch(url)).text()).match(re)![1]!;
}

async function login(password: string) {
  const url = `${BASE}/login`;
  const form = new FormData();
  form.set(await field(url, /name="(\$ACTION_ID_[a-f0-9]+)"/), "");
  form.set("callbackUrl", await field(url, /name="callbackUrl"[^>]*value="([^"]*)"/));
  form.set("email", EMAIL);
  form.set("password", password);
  const r = await fetch(url, {
    method: "POST",
    body: form,
    redirect: "manual",
    headers: { "x-forwarded-for": IP() },
  });
  return r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  const password = randomBytes(24).toString("hex");
  await db.adminUser.create({
    data: { email: EMAIL, passwordHash: await bcrypt.hash(password, 10) },
  });
  const seed = async () =>
    (
      await db.review.create({
        data: {
          authorName: AUTHOR,
          rating: 5,
          body: "Hardening probe. Safe to delete.",
          status: "PENDING",
        },
      })
    ).id;

  try {
    const cookie = await login(password);

    console.log("\n1. I1 - the three review routes work for an admin");
    const listed = await fetch(`${BASE}/api/admin/reviews?status=PENDING`, {
      headers: { cookie },
    });
    check("GET /api/admin/reviews is 200 for an admin", listed.status === 200, `HTTP ${listed.status}`);
    check("and returns the pending queue", Array.isArray(await listed.json()));

    const patchId = await seed();
    const patched = await fetch(`${BASE}/api/admin/reviews/${patchId}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    check("PATCH is 200 for an admin", patched.status === 200, `HTTP ${patched.status}`);
    check(
      "and the row really changed",
      (await db.review.findUnique({ where: { id: patchId } }))?.status === "APPROVED",
    );

    const deleteId = await seed();
    const deleted = await fetch(`${BASE}/api/admin/reviews/${deleteId}`, {
      method: "DELETE",
      headers: { cookie },
    });
    check("DELETE is 200 for an admin", deleted.status === 200, `HTTP ${deleted.status}`);
    check("and the row is gone", (await db.review.findUnique({ where: { id: deleteId } })) === null);

    console.log("\n2. I1 - anonymous is refused");
    const anonId = await seed();
    const anonGet = await fetch(`${BASE}/api/admin/reviews`, { redirect: "manual" });
    const anonPatch = await fetch(`${BASE}/api/admin/reviews/${anonId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
      redirect: "manual",
    });
    const anonDelete = await fetch(`${BASE}/api/admin/reviews/${anonId}`, {
      method: "DELETE",
      redirect: "manual",
    });
    check("GET is 401 for anonymous", anonGet.status === 401, `HTTP ${anonGet.status}`);
    check("PATCH is 401 for anonymous", anonPatch.status === 401, `HTTP ${anonPatch.status}`);
    check("DELETE is 401 for anonymous", anonDelete.status === 401, `HTTP ${anonDelete.status}`);
    check(
      "and the row anonymous tried to approve is untouched",
      (await db.review.findUnique({ where: { id: anonId } }))?.status === "PENDING",
    );

    console.log("\n3. I4 - headers on a page response");
    const page = await fetch(`${BASE}/`);
    const csp = page.headers.get("content-security-policy") ?? "";
    check("Content-Security-Policy present", csp.length > 0);
    check(
      "X-Frame-Options: DENY",
      page.headers.get("x-frame-options") === "DENY",
      page.headers.get("x-frame-options") ?? "(none)",
    );
    check(
      "X-Content-Type-Options: nosniff",
      page.headers.get("x-content-type-options") === "nosniff",
      page.headers.get("x-content-type-options") ?? "(none)",
    );
    check(
      "Referrer-Policy: strict-origin-when-cross-origin",
      page.headers.get("referrer-policy") === "strict-origin-when-cross-origin",
      page.headers.get("referrer-policy") ?? "(none)",
    );
    // Which build is answering, read from the CSP rather than assumed: the dev
    // policy carries 'unsafe-eval' for Turbopack, the production one must not.
    const isDevServer = csp.includes("'unsafe-eval'");
    console.log(`       (server is running in ${isDevServer ? "development" : "production"} mode)`);

    const hsts = page.headers.get("strict-transport-security");
    if (isDevServer) {
      check("HSTS is absent in development", hsts === null, hsts ?? "(absent)");
      check("dev CSP allows ws: for hot reload", /connect-src[^;]*ws:/.test(csp));
    } else {
      check("HSTS is present in production", (hsts ?? "").includes("max-age="), hsts ?? "(absent)");
      check("production CSP has NO 'unsafe-eval'", !csp.includes("'unsafe-eval'"));
      check("production CSP has NO ws:", !/connect-src[^;]*ws:/.test(csp));
    }

    console.log("\n4. I4 - the CSP allows exactly what the app needs");
    const publicOrigin = new URL(process.env.R2_PUBLIC_BASE_URL!).origin;
    const uploadOrigin = new URL(process.env.R2_ENDPOINT!).origin;
    check("frame-ancestors none", csp.includes("frame-ancestors 'none'"));
    check("object-src none", csp.includes("object-src 'none'"));
    check("base-uri self", csp.includes("base-uri 'self'"));
    check("form-action self", csp.includes("form-action 'self'"));
    check("img-src carries the R2 image origin", csp.includes(publicOrigin), publicOrigin);
    check(
      "connect-src carries the R2 upload origin (or admin uploads break)",
      new RegExp(`connect-src[^;]*${uploadOrigin.replace(/[.]/g, "\\.")}`).test(csp),
      uploadOrigin,
    );
    check("default-src self", csp.includes("default-src 'self'"));

    console.log("\n5. I4 - headers reach API responses too");
    const api = await fetch(`${BASE}/api/products`);
    check("GET /api/products still 200", api.status === 200, `HTTP ${api.status}`);
    check("and carries nosniff", api.headers.get("x-content-type-options") === "nosniff");

    console.log("\n6. Real features still work with the headers on");
    for (const path of ["/", "/catalog", "/about", "/contact", "/custom-orders"]) {
      const r = await fetch(`${BASE}${path}`);
      check(`${path} loads`, r.status === 200, `HTTP ${r.status}`);
    }

    const product = await db.product.findFirst({ select: { slug: true, id: true } });
    if (product) {
      const html = await (await fetch(`${BASE}/products/${product.slug}`)).text();
      check("a product page loads", html.length > 0);

      // Only meaningful when the catalogue actually has a photo. Asserted
      // unconditionally this reads as a CSP failure on an empty catalogue,
      // which is what it did the first time it ran — there were no
      // ProductImage rows at all, so there was no <img> to check.
      const imageCount = await db.productImage.count({ where: { productId: product.id } });
      if (imageCount > 0) {
        check(
          "its images go through an origin the CSP allows",
          html.includes("/_next/image") || html.includes(publicOrigin),
        );
      } else {
        console.log("  [skip] no ProductImage rows for this product — nothing to render");
      }

      const presign = await fetch(`${BASE}/api/admin/products/${product.id}/images/presign`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json", "x-forwarded-for": IP() },
        body: JSON.stringify({ contentType: "image/jpeg", fileSize: 120000 }),
      });
      if (presign.status === 200) {
        const { uploadUrl } = (await presign.json()) as { uploadUrl: string };
        check(
          "the presigned upload URL origin is in connect-src",
          csp.includes(new URL(uploadUrl).origin),
          new URL(uploadUrl).origin,
        );
      } else {
        check("presign responded", false, `HTTP ${presign.status}`);
      }
    }

    const chat = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": IP() },
      body: JSON.stringify({ message: "Do you have dining tables?", history: [] }),
    });
    check("the chat endpoint still answers", chat.status === 200, `HTTP ${chat.status}`);

    const review = await fetch(`${BASE}/api/reviews`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": IP() },
      body: JSON.stringify({
        authorName: AUTHOR,
        rating: 5,
        body: "Header probe. Safe to delete.",
        productId: null,
      }),
    });
    check("the review form endpoint still accepts a submission", review.status === 201, `HTTP ${review.status}`);
  } finally {
    await db.review.deleteMany({ where: { authorName: AUTHOR } });
    await db.adminUser.deleteMany({ where: { email: EMAIL } });
    await db.$disconnect();
  }

  console.log(failures === 0 ? "\nAll hardening checks passed.\n" : `\n${failures} FAILED.\n`);
  if (failures) process.exitCode = 1;
}
main();
