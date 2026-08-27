/**
 * Exercises the AI summary flow against a running server.
 *
 *   npm run test:summary          # needs GROQ_API_KEY and `npm run dev`
 *
 * WHAT IT DOES TO YOUR DATABASE, stated up front because it is not nothing:
 *
 *   - Creates a temporary AdminUser with a random password, because the
 *     endpoints under test are admin-only and testing them through the front
 *     door means holding a real session. It is deleted in a finally block.
 *   - Publishes and then clears a summary on ONE product, restoring whatever
 *     was in the column before it started.
 *
 * Both are reverted even when an assertion fails. The alternative — calling
 * the lib functions directly and skipping the route — would test everything
 * except the two things most likely to be wrong: the admin guard, and the
 * second grounding check on the save path.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { checkSummaryGrounding, type SummarySource } from "../lib/ai/summary";
import { significantFiguresIn } from "../lib/ai/grounding";
import { db } from "../lib/db";

const BASE = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:3000";
const TEST_EMAIL = `summary-test-${randomBytes(4).toString("hex")}@invalid.test`;

type Check = { label: string; pass: boolean; detail?: string };
const checks: Check[] = [];

function check(label: string, pass: boolean, detail?: string) {
  checks.push({ label, pass, ...(detail ? { detail } : {}) });
  console.log(
    `    ${pass ? "[ok]  " : "[FAIL]"} ${label}${detail ? `  -> ${detail}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// A very small cookie jar. Enough for one sign-in.
// ---------------------------------------------------------------------------

const jar = new Map<string, string>();

function absorb(response: Response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair?.indexOf("=") ?? -1;
    if (eq > 0) jar.set(pair!.slice(0, eq), pair!.slice(eq + 1));
  }
}

function cookieHeader() {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie: cookieHeader() },
    redirect: "manual",
  });
  absorb(response);
  return response;
}

async function json<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Auth.js credentials sign-in: fetch a CSRF token, then post the form. */
async function signIn(email: string, password: string) {
  const csrfResponse = await request("/api/auth/csrf");
  const csrf = await json<{ csrfToken: string }>(csrfResponse);
  if (!csrf?.csrfToken) throw new Error("could not read a CSRF token");

  const response = await request("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email,
      password,
      callbackUrl: `${BASE}/admin`,
    }).toString(),
  });

  // A successful credentials sign-in redirects and sets the session cookie.
  const signedIn = [...jar.keys()].some((name) => name.includes("session-token"));
  if (!signedIn) {
    throw new Error(
      `sign-in did not produce a session cookie (HTTP ${response.status})`,
    );
  }
}

// ---------------------------------------------------------------------------

type ErrorBody = { error?: { code?: string; message?: string } };

async function main() {
  console.log(`Server: ${BASE}`);

  // A product with rich fields, so a summary has something to be built from.
  const product = await db.product.findFirst({
    where: { slug: "shalimar-king-bed-with-storage" },
    select: {
      id: true,
      slug: true,
      name: true,
      price: true,
      dimensions: true,
      description: true,
      stockStatus: true,
      aiSummary: true,
      category: { select: { name: true } },
    },
  });
  if (!product) throw new Error("seeded product not found");

  const source: SummarySource = {
    name: product.name,
    categoryName: product.category.name,
    price: product.price,
    dimensions: product.dimensions,
    description: product.description,
    stockStatus: product.stockStatus,
  };

  const originalSummary = product.aiSummary;
  console.log(`Product: ${product.name} (${product.slug})`);
  console.log(`Existing aiSummary: ${originalSummary ? "present" : "null"} — restored at the end.\n`);

  const password = randomBytes(24).toString("hex");
  await db.adminUser.create({
    data: { email: TEST_EMAIL, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`Temporary admin created: ${TEST_EMAIL}\n`);

  try {
    // -----------------------------------------------------------------------
    console.log("1. The endpoint is admin-only");
    {
      const anon = await fetch(`${BASE}/api/admin/products/${product.id}/summary`, {
        method: "POST",
        redirect: "manual",
      });
      const body = await json<ErrorBody>(anon);
      check("unauthenticated POST is refused", anon.status === 401, `HTTP ${anon.status}`);
      check("with code UNAUTHORIZED", body?.error?.code === "UNAUTHORIZED");
    }

    await signIn(TEST_EMAIL, password);
    console.log("    (signed in)\n");

    // -----------------------------------------------------------------------
    console.log("2. Generate — writes nothing");
    const before = await db.product.findUnique({
      where: { id: product.id },
      select: { aiSummary: true },
    });

    const generateResponse = await request(
      `/api/admin/products/${product.id}/summary`,
      { method: "POST" },
    );
    const generated = await json<{ summary: string }>(generateResponse);

    if (generateResponse.status !== 200 || !generated?.summary) {
      const body = (generated ?? {}) as ErrorBody;
      check(
        "generation succeeded",
        false,
        `HTTP ${generateResponse.status} ${body.error?.code ?? ""} ${body.error?.message ?? ""}`,
      );
      throw new Error("cannot continue without a draft");
    }

    console.log(`\n    DRAFT: ${generated.summary}\n`);
    check("generation returned a draft", true, `${generated.summary.length} chars`);

    const after = await db.product.findUnique({
      where: { id: product.id },
      select: { aiSummary: true },
    });
    check(
      "the column was NOT written — generate is not publish",
      before?.aiSummary === after?.aiSummary,
    );

    // -----------------------------------------------------------------------
    console.log("\n3. The draft invents nothing");
    {
      const verdict = checkSummaryGrounding(generated.summary, source);
      check(
        "passes the grounding check",
        verdict.grounded,
        verdict.grounded ? undefined : verdict.reason,
      );

      // Independently of the check, assert the property directly against the
      // row: every figure in the summary must be a figure in the product.
      const sourceFigures = significantFiguresIn(
        [source.name, source.price, source.dimensions, source.description].join(" "),
      );
      const invented = [...significantFiguresIn(generated.summary)].filter(
        (value) => !sourceFigures.has(value),
      );
      check(
        "every figure it states appears in the product's own fields",
        invented.length === 0,
        invented.join(", "),
      );

      check(
        "does not quote the price (the page shows it already)",
        !significantFiguresIn(generated.summary).has(source.price),
      );

      const claims = ["warranty", "guarantee", "delivery", "shipping", "discount", "refund"];
      const sourceText = JSON.stringify(source).toLowerCase();
      const unearned = claims.filter(
        (word) =>
          new RegExp(`\\b${word}`, "i").test(generated.summary) &&
          !sourceText.includes(word),
      );
      check(
        "makes no delivery, warranty or discount claim",
        unearned.length === 0,
        unearned.join(", "),
      );

      // The description is the source of truth for materials. A spot check
      // that the summary is actually about THIS product rather than generic
      // furniture copy: it should reuse a distinctive word from the record.
      const distinctive = ["hydraulic", "storage", "headboard", "king"];
      check(
        "is about this product — reuses a distinctive term from its record",
        distinctive.some((word) => new RegExp(word, "i").test(generated.summary)),
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n4. Publish");
    {
      const response = await request(`/api/admin/products/${product.id}/summary`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: generated.summary }),
      });
      check("PUT succeeded", response.status === 200, `HTTP ${response.status}`);

      const row = await db.product.findUnique({
        where: { id: product.id },
        select: { aiSummary: true },
      });
      check("the column now holds the draft", row?.aiSummary === generated.summary);
    }

    // -----------------------------------------------------------------------
    console.log("\n5. It reaches the public product page");
    {
      const page = await fetch(`${BASE}/products/${product.slug}`);
      const html = await page.text();

      // The rendered HTML escapes apostrophes, so compare on a distinctive
      // run of plain words rather than the whole string.
      const probe = generated.summary
        .split(/[^A-Za-z ]/)[0]
        ?.trim()
        .slice(0, 40);

      check("the product page renders", page.status === 200, `HTTP ${page.status}`);
      check(
        "the summary text is on the page",
        Boolean(probe && html.includes(probe)),
        probe,
      );
      check(
        "the 'written by AI' disclosure is shown with it",
        /Written by AI from this/i.test(html),
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n6. Regenerate leaves the published one alone");
    {
      const response = await request(`/api/admin/products/${product.id}/summary`, {
        method: "POST",
      });
      const second = await json<{ summary: string }>(response);
      check("a second draft was generated", response.status === 200 && Boolean(second?.summary));
      if (second?.summary) console.log(`\n    DRAFT 2: ${second.summary}\n`);

      const row = await db.product.findUnique({
        where: { id: product.id },
        select: { aiSummary: true },
      });
      check(
        "the published summary is still the first one",
        row?.aiSummary === generated.summary,
      );

      if (second?.summary) {
        const verdict = checkSummaryGrounding(second.summary, source);
        check(
          "the second draft is grounded too",
          verdict.grounded,
          verdict.grounded ? undefined : verdict.reason,
        );
      }
    }

    // -----------------------------------------------------------------------
    console.log("\n7. A hallucinated summary cannot be saved");
    {
      const fabrications: [string, string][] = [
        [
          "an invented price",
          "A king-size bed in solid sheesham with a lift-up storage base. Now available at just Rs 45,000, reduced from our usual price, while stocks last in the Mardan showroom this month.",
        ],
        [
          "an invented warranty",
          "A king-size bed with a hydraulic lift-up base and a padded headboard, built for full-size storage underneath. Every frame carries a five year warranty against manufacturing defects.",
        ],
        [
          "invented delivery",
          "A king-size bed with a hydraulic lift-up base and a padded headboard giving the full footprint of the bed as storage. Free delivery and assembly are included anywhere in Pakistan.",
        ],
      ];

      for (const [label, text] of fabrications) {
        const response = await request(
          `/api/admin/products/${product.id}/summary`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ summary: text }),
          },
        );
        const body = await json<ErrorBody>(response);
        check(
          `PUT with ${label} is refused`,
          response.status === 422 && body?.error?.code === "AI_UNGROUNDED",
          `HTTP ${response.status} ${body?.error?.code ?? ""}`,
        );
      }

      const row = await db.product.findUnique({
        where: { id: product.id },
        select: { aiSummary: true },
      });
      check(
        "the column still holds the grounded summary",
        row?.aiSummary === generated.summary,
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n8. Clear");
    {
      const response = await request(`/api/admin/products/${product.id}/summary`, {
        method: "DELETE",
      });
      check("DELETE succeeded", response.status === 200, `HTTP ${response.status}`);

      const row = await db.product.findUnique({
        where: { id: product.id },
        select: { aiSummary: true },
      });
      check("the column is null", row?.aiSummary === null);

      const again = await request(`/api/admin/products/${product.id}/summary`, {
        method: "DELETE",
      });
      check("clearing twice is still a 200 — idempotent", again.status === 200);

      const page = await fetch(`${BASE}/products/${product.slug}`);
      const html = await page.text();
      check(
        "the product page falls back to its empty state",
        /hasn&#x27;t been written yet|Summary coming soon/i.test(html),
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n9. The `aiSummary` column is unreachable from the product API");
    {
      const response = await request(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aiSummary: "Written by a human pretending to be a machine." }),
      });
      const body = await json<ErrorBody>(response);
      // productUpdateSchema has no `aiSummary`, and nonEmptyPatch rejects a
      // body that contained nothing else it recognises.
      check(
        "PATCH /api/products/[id] with only aiSummary is rejected",
        response.status === 400,
        `HTTP ${response.status} ${body?.error?.code ?? ""}`,
      );

      const row = await db.product.findUnique({
        where: { id: product.id },
        select: { aiSummary: true },
      });
      check("nothing was written", row?.aiSummary === null);
    }
  } finally {
    console.log("\nCleaning up…");
    await db.product.update({
      where: { id: product.id },
      data: { aiSummary: originalSummary },
    });
    console.log(`  aiSummary restored to ${originalSummary ? "its previous value" : "null"}`);

    await db.adminUser.deleteMany({ where: { email: TEST_EMAIL } });
    console.log(`  temporary admin ${TEST_EMAIL} deleted`);
  }

  const failed = checks.filter((entry) => !entry.pass).length;
  console.log(`\n${"=".repeat(78)}`);
  console.log(failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`);

  await db.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

void main().catch(async (error) => {
  console.error("\nFATAL:", error instanceof Error ? error.message : error);
  await db.adminUser.deleteMany({ where: { email: TEST_EMAIL } }).catch(() => {});
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
