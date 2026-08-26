"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import type { ApiErrorBody } from "@/lib/api";

/**
 * Delete a product, with a confirmation that says what actually goes.
 *
 * A native <dialog> opened with showModal(), not a div pretending to be one.
 * The browser gives focus trapping, Escape-to-close, inert background content
 * and correct semantics for free — all things a hand-rolled modal gets wrong,
 * and this is the one control in the admin that destroys data.
 *
 * The dialog names the piece and counts the rows that go with it, because
 * "Are you sure?" is not a question anybody can answer. `onDelete: Cascade` on
 * ProductImage and Review means those disappear too, and the owner should know
 * that before pressing the button, not after.
 *
 * Errors from the API are shown IN the dialog and the dialog stays open. A
 * failed delete that closes the dialog and leaves the row in place looks
 * exactly like a successful delete that failed to refresh.
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const busy = deleting || isPending;

  // Escape and the backdrop can close the dialog without going through our
  // close handler, so a dismissed dialog must not keep a stale error for the
  // next time it opens.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onClose = () => setError(null);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        // Surface the API's own words. Every non-2xx from this API carries
        // { error: { code, message } }; anything else came from outside it.
        let detail = `${response.status} ${response.statusText}`;
        try {
          const body = (await response.json()) as ApiErrorBody;
          if (body?.error) detail = `${body.error.code}: ${body.error.message}`;
        } catch {
          // Not our envelope — the status line is all we have.
        }
        setError(detail);
        return;
      }

      // Re-render the server component so the row goes. Not an optimistic
      // removal: the table should show what the database says, and a refresh
      // costs one round trip on a page the owner is already looking at.
      dialogRef.current?.close();
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
        onClick={() => dialogRef.current?.showModal()}
        disabled={busy}
        className="px-2 py-1 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        {isPending ? "Removing…" : "Delete"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`delete-heading-${productId}`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] border border-hairline bg-paper p-0 text-ink backdrop:bg-ink/70"
      >
        <div className="p-6">
          <h2
            id={`delete-heading-${productId}`}
            className="display-wide text-xl font-semibold uppercase"
          >
            Delete this product?
          </h2>

          <p className="mt-3 leading-relaxed text-ink">
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
              <span>Images</span>
              <span className="font-mono text-ink">{imageCount}</span>
            </li>
            <li className="flex justify-between gap-4 py-1">
              <span>Customer reviews</span>
              <span className="font-mono text-ink">{reviewCount}</span>
            </li>
          </ul>

          <p className="mt-3 text-sm text-muted">
            Images and reviews are deleted along with the product. This cannot
            be undone.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 border border-brass/50 bg-brass/10 p-3 font-mono text-sm text-ink"
            >
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              disabled={busy}
              className="border border-ink/25 px-4 py-2 font-display text-sm font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="bg-ink px-4 py-2 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {deleting ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
