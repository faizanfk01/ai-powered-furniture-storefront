"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { describeApiFailure } from "@/lib/api-client";

/**
 * Approve, un-approve and reject one review.
 *
 * REJECT IS A DELETE. There is no REJECTED status in the schema, so refusing a
 * review destroys it — the row, the author's words, permanently. That is a
 * genuine deletion wearing a softer word, so the button says "Reject" (what
 * the owner is doing) while the confirmation says "deleted permanently" (what
 * actually happens). A moderation queue where "reject" quietly meant "hide"
 * would be kinder to click and wrong.
 *
 * Approve and un-approve are the same PATCH in opposite directions and need no
 * confirmation: neither destroys anything, and both are undone by pressing the
 * other one.
 */
export function ReviewActions({
  reviewId,
  authorName,
  status,
}: {
  reviewId: string;
  authorName: string;
  status: "PENDING" | "APPROVED";
}) {
  const router = useRouter();

  const [working, setWorking] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const busy = working || isPending;

  async function setStatus(next: "PENDING" | "APPROVED") {
    setWorking(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      if (!response.ok) {
        setError(await describeApiFailure(response));
        return;
      }

      // The list is a Server Component; the row has to move tab.
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(
        cause instanceof Error ? `Request failed: ${cause.message}` : "Request failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    setRejecting(true);
    setRejectError(null);

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setRejectError(await describeApiFailure(response));
        return;
      }

      setConfirmOpen(false);
      startTransition(() => router.refresh());
    } catch (cause) {
      setRejectError(
        cause instanceof Error ? `Request failed: ${cause.message}` : "Request failed.",
      );
    } finally {
      setRejecting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {status === "PENDING" ? (
          <button
            type="button"
            onClick={() => setStatus("APPROVED")}
            disabled={busy}
            className="bg-ink px-4 py-2 font-display text-xs font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {busy ? "Working…" : "Approve"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStatus("PENDING")}
            disabled={busy}
            className="border border-ink/25 px-4 py-2 font-display text-xs font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {busy ? "Working…" : "Un-approve"}
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setRejectError(null);
            setConfirmOpen(true);
          }}
          disabled={busy}
          className="px-3 py-2 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          {status === "PENDING" ? "Reject" : "Delete"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 border border-brass/50 bg-brass/10 p-2 font-mono text-xs text-ink"
        >
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => {
          if (!rejecting) setConfirmOpen(false);
        }}
        onConfirm={reject}
        title={status === "PENDING" ? "Reject this review?" : "Delete this review?"}
        confirmLabel="Delete permanently"
        busy={rejecting}
        error={rejectError}
      >
        <p className="leading-relaxed text-ink">
          {authorName}&rsquo;s review will be deleted permanently. There is no
          rejected state to recover it from — this removes the review from the
          database.
        </p>
        {status === "APPROVED" && (
          <p className="mt-3 text-sm text-muted">
            It is currently visible on the storefront and will disappear
            immediately.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
