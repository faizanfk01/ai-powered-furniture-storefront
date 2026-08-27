"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { describeApiFailure } from "@/lib/api-client";

/**
 * Generate, review, publish, clear — the AI summary for one product.
 *
 * THE SHAPE OF THIS COMPONENT IS THE FEATURE. A single "Generate" button that
 * wrote straight to the column would be half the work and the wrong product:
 * the storefront prints "Written by AI from this product's details" under
 * whatever is in that column, and a claim about provenance is only worth
 * making if a person read the text before it went public. So there are two
 * separate states here — a draft that exists only in this component, and a
 * published summary that exists in the database — and the only way from the
 * first to the second is the owner pressing Publish.
 *
 * Nothing here is optimistic. Every state change follows a response from the
 * server, because the interesting failures (rate limited, draft rejected) are
 * exactly the ones an optimistic UI would paper over.
 */

type Draft = { text: string; at: number };

/** Which control is mid-request. One at a time — they all touch one column. */
type Busy = "generating" | "publishing" | "clearing" | null;

export function SummaryManager({
  productId,
  productName,
  published,
}: {
  productId: string;
  productName: string;
  /** The `aiSummary` column as it stands. Null when nothing is published. */
  published: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const working = busy !== null || isPending;

  async function generate() {
    setBusy("generating");
    setError(null);

    try {
      const response = await fetch(`/api/admin/products/${productId}/summary`, {
        method: "POST",
      });

      if (!response.ok) {
        // describeApiFailure prefixes the code — AI_UNGROUNDED, AI_BUSY — and
        // on this screen that is wanted rather than noise. The owner is the
        // developer; a code they can search for beats a rounded-off sentence.
        setError(await describeApiFailure(response));
        return;
      }

      const body = (await response.json()) as { summary: string };
      setDraft({ text: body.summary, at: Date.now() });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Request failed: ${cause.message}`
          : "Request failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (!draft) return;

    setBusy("publishing");
    setError(null);

    try {
      const response = await fetch(`/api/admin/products/${productId}/summary`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: draft.text }),
      });

      if (!response.ok) {
        setError(await describeApiFailure(response));
        return;
      }

      setDraft(null);
      // The published summary is rendered by the Server Component around this
      // one, so the page is refreshed rather than the new text being pushed
      // into local state. One source of truth for what is live: the database.
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Request failed: ${cause.message}`
          : "Request failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    setBusy("clearing");
    setError(null);

    try {
      const response = await fetch(`/api/admin/products/${productId}/summary`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError(await describeApiFailure(response));
        return;
      }

      setConfirmingClear(false);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Request failed: ${cause.message}`
          : "Request failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="summary-heading" className="max-w-3xl">
      <h2
        id="summary-heading"
        className="display-wide text-lg font-semibold uppercase"
      >
        AI summary
      </h2>
      <p className="mt-1 text-sm text-muted">
        A short paragraph written from this product&rsquo;s own fields — name,
        category, dimensions, description and availability. It appears on the
        public product page under a line saying it was written by AI. Nothing
        is published until you press Publish.
      </p>

      {/* PUBLISHED — what a customer sees right now. */}
      <div className="mt-5 border border-hairline">
        <div className="flex items-center justify-between gap-4 border-b border-hairline bg-hairline/30 px-4 py-2.5">
          <span className="spec-label text-muted">On the product page</span>
          <span
            className={`spec-label ${published ? "text-ink" : "text-muted/70"}`}
          >
            {published ? "Published" : "None"}
          </span>
        </div>

        <div className="px-4 py-4">
          {published ? (
            <p className="leading-relaxed text-ink">{published}</p>
          ) : (
            <p className="text-sm text-muted">
              No summary yet. The product page falls back to the
              workshop&rsquo;s own description, which is the honest default —
              generating one is optional.
            </p>
          )}
        </div>

        {published && (
          <div className="border-t border-hairline px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmingClear(true);
              }}
              disabled={working}
              className="text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              Clear summary
            </button>
          </div>
        )}
      </div>

      {/* DRAFT — exists only in this component until Publish. */}
      {draft && (
        <div className="mt-5 border border-brass/50">
          <div className="flex items-center justify-between gap-4 border-b border-brass/40 bg-brass/10 px-4 py-2.5">
            <span className="spec-label text-ink">Draft — not published</span>
            <span className="spec-label text-muted">
              {draft.text.length} chars
            </span>
          </div>

          <div className="px-4 py-4">
            {/* aria-live so a regenerate is announced: the button stays put and
                only the paragraph changes, which is silent otherwise. */}
            <p aria-live="polite" className="leading-relaxed text-ink">
              {draft.text}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-brass/40 px-4 py-3">
            <button
              type="button"
              onClick={publish}
              disabled={working}
              className="bg-ink px-5 py-2.5 font-display text-xs font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep disabled:cursor-not-allowed disabled:bg-ink/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {busy === "publishing" ? "Publishing…" : "Publish to product page"}
            </button>

            <button
              type="button"
              onClick={generate}
              disabled={working}
              className="border border-ink/25 px-5 py-2.5 font-display text-xs font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink hover:bg-ink/5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              {busy === "generating" ? "Generating…" : "Regenerate"}
            </button>

            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              disabled={working}
              className="px-2 py-2.5 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* GENERATE — hidden while a draft is on screen, because Regenerate is
          the same action and two buttons doing one thing is a question the
          owner has to stop and answer. */}
      {!draft && (
        <div className="mt-5">
          <button
            type="button"
            onClick={generate}
            disabled={working}
            className="border border-ink/25 px-5 py-2.5 font-display text-xs font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink hover:bg-ink/5 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {busy === "generating"
              ? "Generating…"
              : published
                ? "Generate a new summary"
                : "Generate AI summary"}
          </button>

          {busy === "generating" && (
            <p role="status" className="spec-label mt-3 text-muted">
              Writing from this product&rsquo;s details…
            </p>
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 border border-brass/50 bg-brass/10 p-3 font-mono text-xs leading-relaxed text-ink"
        >
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirmingClear}
        onClose={() => {
          if (busy !== "clearing") setConfirmingClear(false);
        }}
        onConfirm={clear}
        title="Clear this summary?"
        confirmLabel="Clear it"
        busy={busy === "clearing"}
        error={null}
      >
        <p className="leading-relaxed text-ink">
          The AI summary is removed from{" "}
          <span className="font-medium">{productName}</span>. The product page
          goes back to showing the workshop&rsquo;s own description on its own.
          You can generate a new one at any time.
        </p>
      </ConfirmDialog>
    </section>
  );
}
