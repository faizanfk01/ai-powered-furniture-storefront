"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A modal confirmation for a destructive action.
 *
 * A native <dialog> driven by showModal(), not a div pretending to be one:
 * focus trapping, Escape-to-close, an inert background and correct semantics
 * all come from the browser, and every one of them is something a hand-rolled
 * modal gets subtly wrong. These are the only controls in the admin that
 * destroy data, so they get the implementation with the fewest ways to fail.
 *
 * Open state is owned by the parent — the caller usually needs it anyway for
 * the request it is about to make — and synchronised into the DOM here.
 * Escape and backdrop dismissal bypass our buttons entirely, so the native
 * `close` event is what reports them back.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
  busy = false,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel: string;
  /** Disables both buttons while the request is in flight. */
  busy?: boolean;
  /** Shown inside the dialog; the dialog stays open so it can be read. */
  error?: string | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Syncing React state into an imperative DOM API is exactly what an effect
  // is for. The `.open` checks matter: calling showModal() on an already-open
  // dialog throws.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Fires for Escape and for backdrop dismissal as well as our own close().
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      // Escape while a request is in flight would leave the dialog gone and
      // the outcome unreported.
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] border border-hairline bg-paper p-0 text-ink backdrop:bg-ink/70"
    >
      <div className="p-6">
        <h2 className="display-wide text-xl font-semibold uppercase">{title}</h2>

        <div className="mt-3">{children}</div>

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
            onClick={onClose}
            disabled={busy}
            className="border border-ink/25 px-4 py-2 font-display text-sm font-medium tracking-wide text-ink uppercase transition-colors hover:border-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="bg-ink px-4 py-2 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
