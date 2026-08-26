import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPage } from "@/components/admin/admin-page";
import { ImageManager } from "@/components/admin/image-manager";
import {
  ProductForm,
  type ProductFormValues,
} from "@/components/admin/product-form";
import { db } from "@/lib/db";
import { productInclude } from "@/lib/products";
import { productPath } from "@/lib/url";

export const metadata: Metadata = {
  title: "Edit product",
};

/**
 * Edit a product. Replaces the 5a stub.
 *
 * A server shell around the same ProductForm the create page uses — it reads
 * the row and the categories, converts the row into form values, and hands
 * both over. Everything else (fields, validation wiring, per-field errors,
 * the slug rules) lives in the one shared component.
 */
export default async function EditProductPage({
  params,
}: PageProps<"/admin/products/[id]/edit">) {
  const { id } = await params;

  // Both in one round trip. The categories are for the dropdown; without them
  // the form would render a select with nothing in it.
  const [product, categories] = await Promise.all([
    // productInclude carries the images already ordered by sortOrder — the
    // same ordering the storefront renders them in.
    db.product.findUnique({ where: { id }, include: productInclude }),
    db.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // The id comes from a URL. A deleted product, or a mistyped link, is a 404
  // rather than an empty form that would create confusion on save.
  if (!product) notFound();

  // Row -> form values. Every field is a string here because that is what an
  // input holds; `price` becomes a number again in the submit payload, and a
  // null `dimensions` becomes "" so the input is empty rather than the text
  // "null".
  const initialValues: ProductFormValues = {
    name: product.name,
    slug: product.slug,
    categoryId: product.categoryId,
    price: String(product.price),
    dimensions: product.dimensions ?? "",
    description: product.description,
    stockStatus: product.stockStatus,
  };

  return (
    <AdminPage
      title="Edit product"
      description={product.name}
      action={
        // Straight to the live page. The owner is editing something customers
        // can see, and checking the result should not mean hunting for it.
        <Link
          href={productPath(product.slug)}
          target="_blank"
          rel="noreferrer"
          className="border border-ink/25 px-4 py-2.5 font-display text-sm font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          View on site ↗
        </Link>
      }
    >
      <ProductForm
        mode="edit"
        categories={categories}
        productId={product.id}
        initialValues={initialValues}
      />

      {/* Images are a separate concern from the fields, and separately saved:
          an upload takes effect immediately, with no Save step, because it is
          already three requests deep by the time it lands. Keeping it visually
          apart from the form stops that difference from being a surprise. */}
      <div className="mt-12 border-t border-hairline pt-10">
        <ImageManager
          productId={product.id}
          productName={product.name}
          images={product.images}
        />
      </div>
    </AdminPage>
  );
}
