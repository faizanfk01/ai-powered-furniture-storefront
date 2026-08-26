"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { describeApiFailure } from "@/lib/api-client";
import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES } from "@/lib/validations/image";

export type ManagedImage = {
  id: string;
  key: string;
  url: string;
  alt: string;
  sortOrder: number;
};

/**
 * Where an upload got to, and where it stopped.
 *
 * The stages are named after the three requests the Phase 2.5b flow actually
 * makes, because "upload failed" is useless when the flow has three places to
 * fail and they mean different things:
 *
 *   presign  — our server refused. A disallowed type or an oversized file;
 *              the message is the API's own validation text.
 *   uploading — R2 refused the PUT. The signature binds content-type and
 *              content-length, so this is where a mismatch surfaces. Also
 *              where a CORS misconfiguration appears, as a thrown fetch with
 *              no readable status.
 *   confirming — the bytes are in the bucket but the row was not written. The
 *              object exists and nothing references it; worth saying plainly,
 *              because a retry will upload a second copy.
 */
type Stage = "queued" | "presign" | "uploading" | "confirming" | "done" | "failed";

type QueueItem = {
  id: string;
  name: string;
  size: number;
  type: string;
  stage: Stage;
  error?: string;
};

const STAGE_LABEL: Record<Stage, string> = {
  queued: "Waiting",
  presign: "Requesting permission…",
  uploading: "Uploading to R2…",
  confirming: "Recording…",
  done: "Done",
  failed: "Failed",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Image management for one product.
 *
 * UI over the Phase 2.5b endpoints, which are unchanged: presign, then a
 * direct browser PUT to R2, then confirm. No upload logic is reimplemented
 * here — this component decides only what order things happen in and what the
 * owner is told while they do.
 *
 * SEQUENTIAL, not parallel. Uploads run one at a time because the confirm
 * endpoint assigns sortOrder as max+1 by reading the current maximum: two
 * confirms racing would read the same maximum and land on the same position,
 * leaving gallery order undefined between them. A queue also keeps a slow
 * connection legible — one file moving is easier to read than six stalled.
 */
export function ImageManager({
  productId,
  productName,
  images,
}: {
  productId: string;
  productName: string;
  images: ManagedImage[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [pendingDelete, setPendingDelete] = useState<ManagedImage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function updateItem(id: string, patch: Partial<QueueItem>) {
    setQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  /** One file, through all three requests. Returns true when a row was made. */
  async function uploadOne(item: QueueItem, file: File) {
    // 1. Ask our server for a URL. This is where the allowlist and the 5 MB
    //    cap are enforced — deliberately not re-checked here, so the admin
    //    can never disagree with the server about what is acceptable.
    updateItem(item.id, { stage: "presign" });

    const presignResponse = await fetch(
      `/api/admin/products/${productId}/images/presign`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
      },
    );

    if (!presignResponse.ok) {
      updateItem(item.id, {
        stage: "failed",
        error: await describeApiFailure(presignResponse),
      });
      return false;
    }

    const presigned = (await presignResponse.json()) as {
      uploadUrl: string;
      key: string;
    };

    // 2. Straight to R2. Never touches our server.
    updateItem(item.id, { stage: "uploading" });

    try {
      const uploadResponse = await fetch(presigned.uploadUrl, {
        method: "PUT",
        // Must match what was signed. Content-Length is set by the browser
        // from the body and cannot be forged here — which is what makes the
        // size limit real rather than advisory.
        headers: { "content-type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        updateItem(item.id, {
          stage: "failed",
          error: `R2 refused the upload — ${uploadResponse.status} ${uploadResponse.statusText}`,
        });
        return false;
      }
    } catch (cause) {
      updateItem(item.id, {
        stage: "failed",
        error: `Upload could not reach R2${
          cause instanceof Error ? ` (${cause.message})` : ""
        }. If this is the only failing step, check the bucket's CORS policy.`,
      });
      return false;
    }

    // 3. Only now does a row exist.
    updateItem(item.id, { stage: "confirming" });

    const confirmResponse = await fetch(
      `/api/admin/products/${productId}/images`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: presigned.key }),
      },
    );

    if (!confirmResponse.ok) {
      updateItem(item.id, {
        stage: "failed",
        error: `${await describeApiFailure(confirmResponse)} — the file reached R2 but was not attached to this product.`,
      });
      return false;
    }

    updateItem(item.id, { stage: "done" });
    return true;
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const items: QueueItem[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      name: file.name,
      size: file.size,
      type: file.type || "(unknown)",
      stage: "queued",
    }));

    setQueue(items);
    setRunning(true);

    // The picker is cleared immediately so the same file can be chosen again
    // after a failure — a file input will not re-fire change for an identical
    // selection.
    if (inputRef.current) inputRef.current.value = "";

    let anySucceeded = false;
    for (let index = 0; index < files.length; index += 1) {
      // Awaited in the loop on purpose — the whole point is that file N+1
      // does not start until file N has been confirmed. See the note on this
      // component for why parallel uploads would scramble sortOrder.
      const ok = await uploadOne(items[index]!, files[index]!);
      anySucceeded ||= ok;
    }

    setRunning(false);

    // One refresh at the end rather than one per file: the list is a Server
    // Component, and re-rendering it six times mid-queue would make the page
    // jump under the owner's cursor.
    if (anySucceeded) startTransition(() => router.refresh());
  }

  async function handleDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/images/${pendingDelete.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        setDeleteError(await describeApiFailure(response));
        return;
      }

      setPendingDelete(null);
      startTransition(() => router.refresh());
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? `Request failed: ${cause.message}` : "Request failed.",
      );
    } finally {
      setDeleting(false);
    }
  }

  const busy = running || isPending;

  return (
    <section aria-labelledby="images-heading" className="max-w-3xl">
      <h2
        id="images-heading"
        className="display-wide text-lg font-semibold uppercase"
      >
        Photographs
      </h2>
      <p className="mt-1 text-sm text-muted">
        Shown on the product page in this order. The first is used on the
        catalogue card. Products with no photograph fall back to a plan drawn
        from their dimensions.
      </p>

      {/* Current images */}
      {images.length === 0 ? (
        <p className="mt-5 border border-hairline p-5 text-sm text-muted">
          No photographs yet.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="border border-hairline">
              <div className="relative aspect-4/3 bg-hairline/50">
                <Image
                  src={image.url}
                  alt={image.alt || productName}
                  fill
                  sizes="(min-width: 640px) 20vw, 45vw"
                  className="object-cover"
                />
                {index === 0 && (
                  <span className="spec-label absolute top-0 left-0 bg-ink px-2 py-1 text-paper">
                    Card image
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="spec-label text-muted">#{image.sortOrder}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setPendingDelete(image);
                  }}
                  disabled={busy}
                  className="text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Picker */}
      <div className="mt-6 border-t border-hairline pt-6">
        <label htmlFor="image-files" className="spec-label block text-muted">
          Add photographs
        </label>

        <input
          ref={inputRef}
          id="image-files"
          type="file"
          multiple
          // A picker convenience only. The allowlist that decides is the
          // server's, and a file that slips past this still gets a real 400.
          accept={IMAGE_CONTENT_TYPES.join(",")}
          disabled={busy}
          onChange={(event) => handleFiles(event.target.files)}
          className="mt-2 block w-full text-sm text-muted file:mr-4 file:border file:border-ink/25 file:bg-paper file:px-4 file:py-2 file:font-display file:text-xs file:font-medium file:tracking-wide file:text-ink file:uppercase hover:file:border-ink disabled:opacity-50"
        />

        <p className="mt-2 text-sm text-muted">
          {IMAGE_CONTENT_TYPES.join(", ")} · up to{" "}
          {MAX_IMAGE_BYTES / (1024 * 1024)} MB each · uploaded one at a time.
        </p>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <ul className="mt-5 border border-hairline">
          {queue.map((item) => (
            <li
              key={item.id}
              className="border-b border-hairline p-3 last:border-b-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="font-mono text-sm text-ink">{item.name}</span>
                <span
                  className={`spec-label ${
                    item.stage === "failed"
                      ? "text-brass"
                      : item.stage === "done"
                        ? "text-muted"
                        : "text-ink"
                  }`}
                >
                  {STAGE_LABEL[item.stage]}
                </span>
              </div>

              <p className="mt-1 font-mono text-xs text-muted">
                {item.type} · {formatBytes(item.size)}
              </p>

              {item.error && (
                <p
                  role="alert"
                  className="mt-2 border border-brass/50 bg-brass/10 p-2 font-mono text-xs text-ink"
                >
                  {item.error}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
        title="Delete this photograph?"
        confirmLabel="Delete permanently"
        busy={deleting}
        error={deleteError}
      >
        <p className="leading-relaxed text-ink">
          The image is removed from{" "}
          <span className="font-medium">{productName}</span> and the file is
          deleted from storage. This cannot be undone.
        </p>
        {pendingDelete && (
          <p className="mt-3 font-mono text-xs break-all text-muted">
            {pendingDelete.key}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
