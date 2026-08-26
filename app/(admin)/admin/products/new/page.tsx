import type { Metadata } from "next";

import { AdminPage } from "@/components/admin/admin-page";
import { ProductForm } from "@/components/admin/product-form";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "New product",
};

/**
 * Create a product.
 *
 * A server shell that does one thing the form cannot: read the categories.
 * The dropdown needs real rows, and fetching them from the client would mean
 * a spinner on a form that could have been rendered complete.
 */
export default async function NewProductPage() {
  const categories = await db.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <AdminPage
      title="New product"
      description="It appears on the storefront as soon as it is saved."
    >
      <ProductForm mode="create" categories={categories} />
    </AdminPage>
  );
}
