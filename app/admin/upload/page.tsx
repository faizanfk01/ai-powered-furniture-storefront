import { connection } from "next/server";

import { db } from "@/lib/db";

import { UploadTester } from "./upload-tester";

/**
 * Test harness for the R2 upload path. Phase 2.5b only.
 *
 * DELIBERATELY UNSTYLED — bare elements, no Tailwind classes, no brand tokens.
 * Phase 5 owns the admin UI; anything decorative here would only be thrown
 * away, and would make it harder to see what the page is actually doing.
 *
 * The reason it exists at all: the browser → R2 PUT is the one leg of this
 * feature that curl cannot exercise. Preflight, allowed headers and allowed
 * origin are all decided by the browser against the bucket's CORS policy, and
 * a server-side test passes happily while the real path is broken.
 *
 * ACCESS: /admin/:path* is covered by the proxy.ts matcher, which redirects an
 * unauthenticated visitor to /login. There is no second check here because
 * this page holds nothing worth protecting on its own — the product list is
 * public data, and every action it takes goes through an API route that
 * enforces its own guard. Removing it from the matcher would leak nothing;
 * removing the API guards would.
 */
export default async function UploadTestPage() {
  // Nothing here reads cookies or headers, so without this the product list
  // would be baked in at build time and go stale the moment a product is added.
  await connection();

  const products = await db.product.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main>
      <h1>R2 upload test</h1>
      <p>
        Phase 2.5b harness. Picks a product, requests a presigned URL, uploads
        the file straight to R2 from this browser, then records the
        ProductImage row.
      </p>

      {products.length === 0 ? (
        <p>
          <strong>No products in the database.</strong> Seed one first.
        </p>
      ) : (
        <UploadTester products={products} />
      )}
    </main>
  );
}
