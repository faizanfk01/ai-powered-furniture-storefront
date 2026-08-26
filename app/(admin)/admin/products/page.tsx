import type { Metadata } from "next";
import Link from "next/link";

import { AdminPage } from "@/components/admin/admin-page";
import { DeleteProductButton } from "@/components/admin/delete-product-button";
import { db } from "@/lib/db";
import { formatPrice, STOCK_LABEL } from "@/lib/format";
import { productInclude } from "@/lib/products";

export const metadata: Metadata = {
  title: "Products",
};

/**
 * The product list.
 *
 * EVERY product, unfiltered and unpaginated. The storefront hides
 * out-of-stock pieces from some views and caps results at 50; this is the
 * owner's inventory, and a management tool that quietly omits rows is worse
 * than useless — you cannot fix what you cannot see. If the catalogue ever
 * outgrows one screen, the answer is a filter the owner controls, not a limit
 * they cannot see.
 *
 * Direct DB read with productInclude, so a row here shows exactly what the
 * storefront shows. `_count` rides along for the reviews, which productInclude
 * does not carry — the delete confirmation needs it to say what it is about
 * to destroy.
 */
export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    include: {
      ...productInclude,
      _count: { select: { reviews: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <AdminPage
      title="Products"
      description={`${products.length} ${products.length === 1 ? "product" : "products"} in the catalogue.`}
      action={
        <Link
          href="/admin/products/new"
          className="bg-ink px-4 py-2.5 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Add product
        </Link>
      }
    >
      {products.length === 0 ? (
        <div className="border border-hairline p-8">
          <h2 className="display-wide text-lg font-medium uppercase">
            No products yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            The catalogue is empty, so the storefront has nothing to show.
          </p>
          <Link
            href="/admin/products/new"
            className="mt-5 inline-block bg-ink px-4 py-2.5 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep"
          >
            Add the first product
          </Link>
        </div>
      ) : (
        // Tables do not reflow, so the narrow-screen answer is a scroll
        // container rather than a card layout that hides the columns you came
        // to compare.
        <div className="overflow-x-auto border border-hairline">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline bg-hairline/40">
                <Th>Product</Th>
                <Th>Category</Th>
                <Th align="right">Price</Th>
                <Th>Stock</Th>
                <Th align="right">Images</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>

            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-hairline last:border-b-0 hover:bg-hairline/25"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{product.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      {product.slug}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-muted">
                    {product.category.name}
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-ink">
                    {formatPrice(product.price)}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={
                        product.stockStatus === "MADE_TO_ORDER"
                          ? "text-brass"
                          : product.stockStatus === "OUT_OF_STOCK"
                            ? "text-muted/60"
                            : "text-muted"
                      }
                    >
                      {STOCK_LABEL[product.stockStatus]}
                    </span>
                  </td>

                  {/* Zero images is the actionable case, so it is the one
                      that reads differently from the rest of the column. */}
                  <td className="px-4 py-3 text-right font-mono">
                    <span
                      className={
                        product.images.length === 0 ? "text-brass" : "text-ink"
                      }
                    >
                      {product.images.length}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="px-2 py-1 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                      >
                        Edit
                      </Link>

                      <DeleteProductButton
                        productId={product.id}
                        productName={product.name}
                        imageCount={product.images.length}
                        reviewCount={product._count.reviews}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`spec-label px-4 py-2.5 font-normal text-muted ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
