import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminPage } from "@/components/admin/admin-page";
import { CategoryForm } from "@/components/admin/category-form";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Edit category",
};

export default async function EditCategoryPage({
  params,
}: PageProps<"/admin/categories/[id]/edit">) {
  const { id } = await params;

  const category = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });

  if (!category) notFound();

  return (
    <AdminPage
      title="Edit category"
      description={`${category.name} — ${category._count.products} ${
        category._count.products === 1 ? "product" : "products"
      }`}
    >
      <CategoryForm
        mode="edit"
        categoryId={category.id}
        initialValues={{ name: category.name, slug: category.slug }}
      />
    </AdminPage>
  );
}
