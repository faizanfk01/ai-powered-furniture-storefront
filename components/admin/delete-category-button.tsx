"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { describeApiFailure } from "@/lib/api-client";

/**
 * Delete a category.
 *
 * `Product.categoryId` is `onDelete: Restrict`, so the database refuses to
 * delete a category that still has products — the API turns that into a 409
 * "Cannot delete a category that still has products".
 *
 * That refusal is a feature, and the UI treats it as one. The product count is
 * shown before the button is ever pressed, so the owner knows which categories
 * are deletable without discovering it by failing; and when the 409 does
 * arrive, it is paired with the number and the thing to do about it, rather
 * than being reported as an error the owner caused.
 */
export function DeleteCategoryButton({
  categoryId,
  categoryName,
  productCount,
}: {
  categoryId: string;
  categoryName: string;
  productCount: number;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const blocked = productCount > 0;

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await describeApiFailure(response));
        return;
      }

      setOpen(false);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Request failed: ${cause.message}`
          : "Request failed.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={deleting || isPending}
        className="px-2 py-1 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        {isPending ? "Removing…" : "Delete"}
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => {
          if (!deleting) setOpen(false);
        }}
        onConfirm={handleDelete}
        title={blocked ? "This category is in use" : "Delete this category?"}
        confirmLabel={blocked ? "Try anyway" : "Delete permanently"}
        busy={deleting}
        error={error}
      >
        {blocked ? (
          <>
            <p className="leading-relaxed text-ink">
              <span className="font-medium">{categoryName}</span> still has{" "}
              <span className="font-mono">{productCount}</span>{" "}
              {productCount === 1 ? "product" : "products"}. Move or delete{" "}
              {productCount === 1 ? "it" : "them"} first — the catalogue will
              not delete a category out from under its products.
            </p>
            <p className="mt-3 text-sm text-muted">
              Reassign each product to another category on its edit screen, or
              delete the products outright.
            </p>
          </>
        ) : (
          <p className="leading-relaxed text-ink">
            <span className="font-medium">{categoryName}</span> has no products
            and will be removed permanently. This cannot be undone.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
