/**
 * One-off verification for removing the /admin/upload test harness.
 *
 *   npx tsx scripts/verify-admin-cleanup.ts
 *
 * Checks the three things the removal has to be true about, through a real
 * signed-in session — the admin surface is behind proxy.ts, so an anonymous
 * request cannot tell a deleted page from a protected one. Creates a
 * temporary AdminUser and deletes it in a finally block, the same as
 * scripts/test-summary.ts.
 *
 * Delete this file once the cleanup is reviewed; it verifies a one-time change
 * and is not part of the suite.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { db } from "../lib/db";

const BASE = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:3000";
const TEST_EMAIL = `cleanup-check-${randomBytes(4).toString("hex")}@invalid.test`;

let failures = 0;
function check(label: string, pass: boolean, detail?: string) {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "[ok]  " : "[FAIL]"} ${label}${detail ? `  -> ${detail}` : ""}`);
}

const jar = new Map<string, string>();
function absorb(response: Response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
  }
}
async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    },
    redirect: "manual",
  });
  absorb(response);
  return response;
}

async function main() {
  const password = randomBytes(24).toString("hex");
  await db.adminUser.create({
    data: { email: TEST_EMAIL, passwordHash: await bcrypt.hash(password, 10) },
  });

  try {
    const csrf = (await (await request("/api/auth/csrf")).json()) as {
      csrfToken: string;
    };
    await request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email: TEST_EMAIL,
        password,
        callbackUrl: `${BASE}/admin`,
      }).toString(),
    });
    if (![...jar.keys()].some((name) => name.includes("session-token"))) {
      throw new Error("sign-in failed");
    }

    console.log("\n1. The sidebar no longer offers the test page");
    {
      const dashboard = await request("/admin");
      const html = await dashboard.text();
      check("the dashboard renders", dashboard.status === 200, `HTTP ${dashboard.status}`);
      check("no 'Image upload test' entry", !html.includes("Image upload test"));
      check("no link to /admin/upload", !/href="\/admin\/upload"/.test(html));
      check("the real nav entries are still there",
        ["Dashboard", "Products", "Categories", "Reviews"].every((label) =>
          html.includes(`>${label}<`),
        ),
      );
    }

    console.log("\n2. /admin/upload is gone");
    {
      const gone = await request("/admin/upload");
      check(
        "signed in, it is a 404 — not a redirect and not a page",
        gone.status === 404,
        `HTTP ${gone.status}`,
      );
    }

    console.log("\n3. The real product-image management still works");
    const product = await db.product.findFirst({ select: { id: true, name: true } });
    if (!product) throw new Error("no products");
    {
      const edit = await request(`/admin/products/${product.id}/edit`);
      const html = await edit.text();
      check("the edit screen renders", edit.status === 200, `HTTP ${edit.status}`);
      check("the Photographs manager is present", html.includes("Photographs"));
      check(
        "its file picker is present",
        html.includes('id="image-files"') || html.includes("Add photographs"),
      );

      // The upload path itself, up to the point where the browser would PUT.
      // This is the leg the deleted harness existed to exercise; the product
      // edit screen uses the same three endpoints.
      const presign = await request(
        `/api/admin/products/${product.id}/images/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType: "image/webp", fileSize: 12_345 }),
        },
      );
      const body = (await presign.json()) as {
        uploadUrl?: string;
        key?: string;
        error?: { code?: string; message?: string };
      };

      if (presign.status === 200) {
        check("presign issues a signed upload URL", Boolean(body.uploadUrl));
        check(
          "the key is scoped to this product",
          Boolean(body.key?.startsWith(`products/${product.id}/`)),
          body.key,
        );
      } else {
        check(
          "presign responded (R2 credentials may not be configured locally)",
          false,
          `HTTP ${presign.status} ${body.error?.code ?? ""} ${body.error?.message ?? ""}`,
        );
      }

      // The validation guard on that endpoint is untouched too.
      const rejected = await request(
        `/api/admin/products/${product.id}/images/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentType: "application/pdf", fileSize: 100 }),
        },
      );
      check(
        "a disallowed file type is still rejected",
        rejected.status === 400,
        `HTTP ${rejected.status}`,
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
