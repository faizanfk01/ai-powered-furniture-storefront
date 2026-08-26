"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { describeApiFailure } from "@/lib/api-client";

/**
 * Delete a product, with a confirmation that says what actually goes.
 *
 * The dialog names the piece and counts the rows that go with it, because
 * "Are you sure?" is not a question anybody can answer. `onDelete: Cascade` on
 * ProductImage and Review means those disappear too, and the owner should know
 * that before pressing the button, not after.
 *
 * Errors are shown IN the dialog and the dialog stays open. A failed delete
 * that closes the dialog and leaves the row in place looks exactly like a
 * successful delete that failed to refresh.
 */
export function DeleteProductButton({
  productId,
  productName,
  imageCount,
  reviewCount,
}: {
  productId: string;
  productName: string;
  imageCount: number;
  reviewCount: number;
}) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await describeApiFailure(response));
        return;
      }

      setOpen(false);
      // Re-render the server component so the row goes. Not an optimistic
      // removal: the table should show what the database says.
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
        title="Delete this product?"
        confirmLabel="Delete permanently"
        busy={deleting}
        error={error}
      >
        <p className="leading-relaxed text-ink">
          <span className="font-medium">{productName}</span> will be removed
          from the catalogue permanently.
        </p>

        {/* What goes with it. Spelled out rather than implied by the word
            "permanently". */}
        <ul className="mt-4 border-y border-hairline py-3 text-sm text-muted">
          <li className="flex justify-between gap-4 py-1">
            <span>Product record</span>
            <span className="font-mono text-ink">1</span>
          </li>
          <li className="flex justify-between gap-4 py-1">
            <span>Images (files and records)</span>
            <span className="font-mono text-ink">{imageCount}</span>
          </li>
          <li className="flex justify-between gap-4 py-1">
            <span>Customer reviews</span>
            <span className="font-mono text-ink">{reviewCount}</span>
          </li>
        </ul>

        <p className="mt-3 text-sm text-muted">
          Images and reviews are deleted along with the product. This cannot be
          undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
