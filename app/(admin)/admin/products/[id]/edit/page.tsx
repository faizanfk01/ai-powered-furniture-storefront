import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPage } from "@/components/admin/admin-page";
import { db } from "@/lib/db";
import { formatPrice, STOCK_LABEL } from "@/lib/format";

export const metadata: Metadata = {
  title: "Edit product",
};

/**
 * STUB — Phase 5b replaces this file wholesale with the real edit form.
 *
 * It exists so the Edit link in the product list lands somewhere that names
 * the product and says what is coming, instead of a bare 404 that reads like
 * a broken admin. It deliberately does nothing: no fields, no save, nothing
 * that could be mistaken for a form that failed to submit.
 *
 * The 404 for an unknown id is real, not a placeholder — the id comes from a
 * URL, and a page that cheerfully renders "Edit product" for a row that does
 * not exist would be a worse stub than none.
 */
export default async function EditProductStubPage({
  params,
}: PageProps<"/admin/products/[id]/edit">) {
  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!product) notFound();

  return (
    <AdminPage
      title="Edit product"
      description="The edit form arrives in the next sub-phase."
    >
      <div className="max-w-2xl border border-hairline p-6">
        <p className="spec-label text-brass">Not built yet</p>

        <h2 className="display-wide mt-3 text-xl font-medium uppercase">
          {product.name}
        </h2>

        <dl className="mt-5 border-t border-hairline text-sm">
          <Row label="Slug" value={product.slug} />
          <Row label="Category" value={product.category.name} />
          <Row label="Price" value={formatPrice(product.price)} />
          <Row label="Stock" value={STOCK_LABEL[product.stockStatus]} />
          <Row label="Dimensions" value={product.dimensions ?? "—"} />
        </dl>

        <p className="mt-5 text-sm text-muted">
          Editing these fields is Phase 5b. Until then the API route{" "}
          <span className="font-mono text-ink">
            PATCH /api/products/{product.id}
          </span>{" "}
          is the way to change them.
        </p>

        <Link
          href="/admin/products"
          className="mt-6 inline-block text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
        >
          ← Back to products
        </Link>
      </div>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-6 border-b border-hairline py-2">
      <dt className="spec-label text-muted">{label}</dt>
      <dd className="text-right font-mono text-ink">{value}</dd>
    </div>
  );
}
