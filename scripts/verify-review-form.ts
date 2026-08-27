/**
 * Verifies the review submission form against the existing POST /api/reviews.
 *
 *   npx tsx scripts/verify-review-form.ts
 *
 * Checks the four claims the form makes, from the outside:
 *   1. a submitted review lands as PENDING
 *   2. a PENDING review is invisible on the storefront
 *   3. the client cannot publish one by asking
 *   4. the API rejects bad input per FIELD, with the names the form maps by
 *
 * Every review it creates carries a marker in its body and is deleted in a
 * finally block. One-off, for this refactor. Not part of the suite.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";

import { db } from "../lib/db";

const BASE = process.env.ADMIN_TEST_URL ?? "http://127.0.0.1:3000";
const MARKER = `verify-review-${randomBytes(4).toString("hex")}`;

let failures = 0;
function check(label: string, pass: boolean, detail?: string) {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "[ok]  " : "[FAIL]"} ${label}${detail ? `  -> ${detail}` : ""}`);
}

type Issue = { path: string; message: string };
type ErrorBody = { error?: { code?: string; message?: string; issues?: Issue[] } };

async function post(payload: unknown) {
  const response = await fetch(`${BASE}/api/reviews`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* left null */
  }
  return { response, body };
}

async function main() {
  const product = await db.product.findFirst({
    select: { id: true, name: true, slug: true },
  });
  if (!product) throw new Error("no products");

  try {
    // -----------------------------------------------------------------------
    console.log("\n1. A submitted review lands as PENDING");
    let createdId = "";
    {
      const { response, body } = await post({
        authorName: "Disposable Tester",
        rating: 5,
        body: `${MARKER} — a general store review submitted by the verification script.`,
        productId: null,
      });

      check("HTTP 201", response.status === 201, `HTTP ${response.status}`);
      createdId = (body as { id?: string })?.id ?? "";
      check("the response carries a row id", Boolean(createdId));

      const row = await db.review.findUnique({ where: { id: createdId } });
      check("the row exists", Boolean(row));
      check("its status is PENDING", row?.status === "PENDING", row?.status);
      check("productId is null for a store review", row?.productId === null);
    }

    // -----------------------------------------------------------------------
    console.log("\n2. A PENDING review is invisible on the storefront");
    {
      const listed = (await (await fetch(`${BASE}/api/reviews`)).json()) as {
        id: string;
      }[];
      check(
        "GET /api/reviews does not return it",
        !listed.some((review) => review.id === createdId),
        `${listed.length} approved review(s) returned`,
      );

      const home = await (await fetch(`${BASE}/`)).text();
      check("its text is not on the home page", !home.includes(MARKER));
    }

    // -----------------------------------------------------------------------
    console.log("\n3. The client cannot publish one by asking");
    {
      const { response, body } = await post({
        authorName: "Disposable Tester",
        rating: 5,
        body: `${MARKER} — this submission tried to set status APPROVED.`,
        productId: product.id,
        status: "APPROVED",
      });

      check("still accepted", response.status === 201, `HTTP ${response.status}`);

      const id = (body as { id?: string })?.id ?? "";
      const row = await db.review.findUnique({ where: { id } });
      check(
        "and STILL stored as PENDING — the extra field was ignored",
        row?.status === "PENDING",
        row?.status,
      );
      check(
        "the product review is attributed to the product",
        row?.productId === product.id,
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n4. Bad input is rejected per field, by the names the form maps");
    {
      const { response, body } = await post({
        authorName: "",
        rating: 9,
        body: "",
      });
      const error = (body as ErrorBody).error;
      const paths = (error?.issues ?? []).map((issue) => issue.path);

      check("HTTP 400", response.status === 400, `HTTP ${response.status}`);
      check("code is VALIDATION_FAILED", error?.code === "VALIDATION_FAILED");
      check("an issue for `authorName`", paths.includes("authorName"), paths.join(", "));
      check("an issue for `rating`", paths.includes("rating"));
      check("an issue for `body`", paths.includes("body"));
      console.log(
        `    (messages the form will show: ${(error?.issues ?? [])
          .map((issue) => `${issue.path}: "${issue.message}"`)
          .join(" | ")})`,
      );

      // The rating radio can be left untouched, which sends 0.
      const noRating = await post({
        authorName: "Someone",
        rating: 0,
        body: "Text",
      });
      const noRatingPaths = ((noRating.body as ErrorBody).error?.issues ?? []).map(
        (issue) => issue.path,
      );
      check(
        "an unchosen rating (0) is rejected on `rating`",
        noRating.response.status === 400 && noRatingPaths.includes("rating"),
        noRatingPaths.join(", "),
      );
    }

    // -----------------------------------------------------------------------
    console.log("\n5. The form is on both pages it was placed on");
    {
      const home = await (await fetch(`${BASE}/`)).text();
      const productPage = await (
        await fetch(`${BASE}/products/${product.slug}`)
      ).text();

      check("home page renders the store-review form", home.includes("Been to the showroom?"));
      check(
        "product page renders a product-review form",
        productPage.includes(`Reviewed the ${product.name}?`),
      );
      check(
        "both say a person reads it before it appears",
        home.includes("read by someone at the shop") &&
          productPage.includes("read by someone at the shop"),
      );
    }
  } finally {
    const removed = await db.review.deleteMany({
      where: { body: { contains: MARKER } },
    });
    console.log(`\ncleanup: ${removed.count} disposable review(s) deleted`);

    const left = await db.review.count({ where: { body: { contains: MARKER } } });
    console.log(`         ${left} remaining with the marker`);
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  await db.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch(async (error) => {
  console.error("FATAL:", error instanceof Error ? error.message : error);
  await db.review
    .deleteMany({ where: { body: { contains: MARKER } } })
    .catch(() => {});
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
