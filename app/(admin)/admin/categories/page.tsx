import type { Metadata } from "next";
import Link from "next/link";

import { AdminPage } from "@/components/admin/admin-page";
import { DeleteCategoryButton } from "@/components/admin/delete-category-button";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Categories",
};

/**
 * The category list.
 *
 * The product count is the point of this screen, not decoration. A category
 * with products cannot be deleted (Product.categoryId is onDelete: Restrict),
 * so showing the count turns "delete, fail, read the error, work out why" into
 * something the owner can see before touching anything.
 */
export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  const empty = categories.filter((c) => c._count.products === 0).length;

  return (
    <AdminPage
      title="Categories"
      description={
        categories.length === 0
          ? "None yet."
          : `${categories.length} ${categories.length === 1 ? "category" : "categories"}, ${empty} with no products.`
      }
      action={
        <Link
          href="/admin/categories/new"
          className="bg-ink px-4 py-2.5 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Add category
        </Link>
      }
    >
      {categories.length === 0 ? (
        <div className="border border-hairline p-8">
          <h2 className="display-wide text-lg font-medium uppercase">
            No categories yet
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted">
            Every product belongs to a category, so nothing can be added to the
            catalogue until one exists.
          </p>
          <Link
            href="/admin/categories/new"
            className="mt-5 inline-block bg-ink px-4 py-2.5 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep"
          >
            Add the first category
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto border border-hairline">
          {/* See the note on the products table: min-w makes the wrapper's
              overflow-x-auto do something on a narrow screen. */}
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-hairline bg-hairline/40">
                <th scope="col" className="spec-label px-4 py-2.5 font-normal text-muted">
                  Category
                </th>
                <th scope="col" className="spec-label px-4 py-2.5 text-right font-normal text-muted">
                  Products
                </th>
                <th scope="col" className="spec-label px-4 py-2.5 text-right font-normal text-muted">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-hairline last:border-b-0 hover:bg-hairline/25"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">{category.name}</span>
                    <span className="mt-0.5 block font-mono text-xs text-muted">
                      {category.slug}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    {category._count.products === 0 ? (
                      <span className="font-mono text-muted/60">0</span>
                    ) : (
                      // A link, because the next thing the owner wants after
                      // seeing a count is the products behind it.
                      <Link
                        href={`/catalog?category=${category.slug}`}
                        className="font-mono text-ink underline decoration-hairline underline-offset-4 transition-colors hover:decoration-brass"
                      >
                        {category._count.products}
                      </Link>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/categories/${category.id}/edit`}
                        className="px-2 py-1 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                      >
                        Edit
                      </Link>

                      <DeleteCategoryButton
                        categoryId={category.id}
                        categoryName={category.name}
                        productCount={category._count.products}
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
