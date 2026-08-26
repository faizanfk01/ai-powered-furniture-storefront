"use client";

import { useState } from "react";

import type { ApiErrorBody } from "@/lib/api";

type Product = { id: string; name: string };

type ProductImage = {
  id: string;
  productId: string;
  key: string;
  url: string;
  alt: string;
  sortOrder: number;
};

type PresignResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
};

/**
 * Pulls a message out of our own error envelope. Every non-2xx from the API
 * has the { error: { code, message, issues? } } shape, so the log can show
 * what actually went wrong instead of "Request failed".
 */
async function describeApiFailure(response: Response) {
  let body: ApiErrorBody | null = null;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    // A non-JSON error body means the failure came from somewhere that isn't
    // our API — the dev server, a proxy — and the status is all we have.
  }

  const detail = body?.error
    ? `${body.error.code}: ${body.error.message}` +
      (body.error.issues?.length
        ? ` (${body.error.issues
            .map((issue) => `${issue.path || "body"} — ${issue.message}`)
            .join("; ")})`
        : "")
    : response.statusText;

  return `${response.status} ${detail}`;
}

export function UploadTester({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState(products[0]!.id);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [image, setImage] = useState<ProductImage | null>(null);
  const [busy, setBusy] = useState(false);

  function note(line: string) {
    setLog((previous) => [
      ...previous,
      `${new Date().toISOString().slice(11, 23)}  ${line}`,
    ]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setImage(null);
    setLog([]);

    try {
      note(`file: ${file.name} — ${file.type || "(no type)"} — ${file.size} bytes`);

      // 1. Ask our server for permission to write one object.
      note("POST …/images/presign");
      const presignResponse = await fetch(
        `/api/admin/products/${productId}/images/presign`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          // file.type is whatever the OS told the browser. The server treats
          // it as a claim, not a fact: it is the value signed into the URL, so
          // a lie here produces a URL the upload cannot use.
          body: JSON.stringify({ contentType: file.type, fileSize: file.size }),
        },
      );

      if (!presignResponse.ok) {
        note(`presign failed — ${await describeApiFailure(presignResponse)}`);
        return;
      }

      const presigned = (await presignResponse.json()) as PresignResponse;
      note(`key: ${presigned.key}`);
      note(`url valid for ${presigned.expiresIn}s`);

      // 2. The bytes go straight to R2. This request never touches our server —
      //    it is the leg that the bucket's CORS policy governs, and a failure
      //    here with status 0 is a CORS rejection rather than an R2 refusal.
      note("PUT → R2 (direct from browser)");
      const uploadResponse = await fetch(presigned.uploadUrl, {
        method: "PUT",
        // content-type must match what was signed. content-length is set by
        // the browser from the body and cannot be set here — which is exactly
        // why signing it is worth anything.
        headers: { "content-type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        note(`R2 refused the upload — ${uploadResponse.status} ${uploadResponse.statusText}`);
        return;
      }
      note(`R2 accepted — ${uploadResponse.status}`);

      // 3. Only now does a row exist.
      note("POST …/images (confirm)");
      const confirmResponse = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: presigned.key, alt }),
      });

      if (!confirmResponse.ok) {
        note(`confirm failed — ${await describeApiFailure(confirmResponse)}`);
        return;
      }

      const row = (await confirmResponse.json()) as ProductImage;
      setImage(row);
      note(`ProductImage ${row.id} created at sortOrder ${row.sortOrder}`);
    } catch (error) {
      // A thrown fetch (rather than a non-ok response) is the CORS case: the
      // browser blocks the response before any status is readable.
      note(
        `threw: ${error instanceof Error ? error.message : String(error)} ` +
          "— if this was the PUT, check the bucket's CORS policy",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <p>
          <label htmlFor="product">Product</label>
          <br />
          <select
            id="product"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </p>

        <p>
          <label htmlFor="file">Image</label>
          <br />
          {/* `accept` is a file-picker convenience only. The allowlist that
              matters is enforced at presign time and by the signature. */}
          <input
            id="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </p>

        <p>
          <label htmlFor="alt">Alt text (optional)</label>
          <br />
          <input
            id="alt"
            type="text"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </p>

        <p>
          <button type="submit" disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </p>
      </form>

      {log.length > 0 && (
        <>
          <h2>Log</h2>
          <pre>{log.join("\n")}</pre>
        </>
      )}

      {image && (
        <>
          <h2>Result</h2>
          <p>
            Public URL:{" "}
            <a href={image.url} target="_blank" rel="noreferrer">
              {image.url}
            </a>
          </p>
          <pre>{JSON.stringify(image, null, 2)}</pre>

          <h2>Loaded from R2</h2>
          {/* A plain <img>, not next/image: the point is to prove the public
              URL serves the bytes, and next/image would put its optimizer
              between us and the answer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.alt}
            width={400}
            onError={() => note(`<img> failed to load ${image.url}`)}
            onLoad={() => note("<img> loaded from the public R2 URL")}
          />
        </>
      )}
    </>
  );
}
