import type { Metadata } from "next";

import { AdminPage } from "@/components/admin/admin-page";
import { CategoryForm } from "@/components/admin/category-form";

export const metadata: Metadata = {
  title: "New category",
};

export default function NewCategoryPage() {
  return (
    <AdminPage
      title="New category"
      description="Categories group the catalogue and drive its filter."
    >
      <CategoryForm mode="create" />
    </AdminPage>
  );
}
