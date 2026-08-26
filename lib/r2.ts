import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  IMAGE_EXTENSIONS,
  type ImageContentType,
} from "./validations/image";

/**
 * Cloudflare R2 client.
 *
 * R2 speaks the S3 API, so the AWS SDK talks to it unchanged once three things
 * are set: a custom endpoint, path-style addressing, and the literal region
 * "auto" (R2 has no regions, but SigV4 requires *some* region in the signature
 * and Cloudflare only accepts that one).
 */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
//
// Same shape as lib/db.ts: read at module load and fail loudly, so a missing
// credential is a startup error naming the variable rather than an opaque 500
// from the middle of an upload.

const REQUIRED_ENV = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_BASE_URL",
] as const;

type RequiredEnv = Record<(typeof REQUIRED_ENV)[number], string>;

function readEnv(): RequiredEnv {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Cloudflare R2 is not configured. Missing: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill in the R2 values.",
    );
  }

  return Object.fromEntries(
    REQUIRED_ENV.map((name) => [name, process.env[name]!.trim()]),
  ) as RequiredEnv;
}

const env = readEnv();

/** Bucket every object in this app is written to. */
export const R2_BUCKET = env.R2_BUCKET_NAME;

/**
 * Public origin images are served from (the r2.dev domain, or a custom one
 * later). Trailing slash stripped so `publicUrl()` can join with exactly one.
 */
const PUBLIC_BASE_URL = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "");

/** Browser-facing URL for a stored object key. */
export function publicUrl(key: string) {
  return `${PUBLIC_BASE_URL}/${key}`;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    // `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`. Without
    // this the SDK builds a virtual-host URL (`<bucket>.<account>...`), which
    // is not a hostname R2 answers on.
    forcePathStyle: true,
    // Since v3.729 the SDK adds a CRC32 checksum header to every PutObject by
    // default. R2 rejects the request when that header is signed into a
    // presigned URL but the browser (which cannot compute it) does not send
    // it. "WHEN_REQUIRED" keeps checksums off unless an operation demands one.
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

type R2ClientSingleton = ReturnType<typeof createR2Client>;

// As in lib/db.ts: dev hot-reload re-evaluates this module on every edit, and
// each S3Client owns an HTTP agent with a socket pool. globalThis survives
// HMR; the module scope does not.
const globalForR2 = globalThis as unknown as {
  r2: R2ClientSingleton | undefined;
};

export const r2: R2ClientSingleton = globalForR2.r2 ?? createR2Client();

if (process.env.NODE_ENV !== "production") {
  globalForR2.r2 = r2;
}

// ---------------------------------------------------------------------------
// Object keys
// ---------------------------------------------------------------------------

/**
 * Where a product photo lives in the bucket:
 *
 *   products/<productId>/<uuid>.<ext>
 *
 * Every part is chosen by the server. The client sends a content type and a
 * byte count and nothing else — no filename, no path — so there is no input to
 * escape and nothing to traverse. Two consequences worth stating:
 *
 *   - A random uuid means an upload can never overwrite an existing object,
 *     even for the same product and the same original filename.
 *   - The productId prefix comes from the row we just looked up, not from the
 *     URL segment the caller typed. A request for a product that does not
 *     exist is a 404 before this function is ever reached.
 */
export function buildImageKey(productId: string, contentType: ImageContentType) {
  return `products/${productId}/${randomUUID()}.${IMAGE_EXTENSIONS[contentType]}`;
}

// ---------------------------------------------------------------------------
// Presigned uploads
// ---------------------------------------------------------------------------

/**
 * Long enough for an admin on a slow connection to finish a 5 MB upload,
 * short enough that a URL leaked from a browser history or a proxy log is
 * worthless by the time anyone finds it.
 */
const PRESIGN_TTL_SECONDS = 300;

/**
 * A URL the browser may PUT one specific object to, once.
 *
 * THE IMPORTANT PART is `signableHeaders`. By default a presigned PUT signs
 * only `host`, which would make ContentType and ContentLength suggestions the
 * client is free to ignore — it could take a URL issued for a 40 KB JPEG and
 * push a 900 MB executable through it. Naming them here folds both into the
 * SigV4 signature, so R2 recomputes it from the headers actually sent and
 * rejects the request outright if either differs.
 *
 * That makes the size limit exact rather than an upper bound: the upload must
 * be precisely the byte count the server approved. The browser sets
 * Content-Length itself from the body (script cannot forge it — it is a
 * forbidden header name), so a client that lies about `fileSize` to get a URL
 * simply cannot use the URL it gets.
 */
export async function presignImageUpload(options: {
  key: string;
  contentType: ImageContentType;
  contentLength: number;
}) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: options.key,
    ContentType: options.contentType,
    ContentLength: options.contentLength,
  });

  const uploadUrl = await getSignedUrl(r2, command, {
    expiresIn: PRESIGN_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });

  return { uploadUrl, expiresIn: PRESIGN_TTL_SECONDS };
}

/**
 * The filename half of a key we issued: a v4 uuid and one of our extensions.
 * Built from IMAGE_EXTENSIONS so it cannot drift from what buildImageKey
 * produces.
 */
const IMAGE_FILENAME_PATTERN = new RegExp(
  `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:${Object.values(
    IMAGE_EXTENSIONS,
  ).join("|")})$`,
);

/**
 * Does `key` look like a key this server issued for this product?
 *
 * The confirm step takes the key back from the client, and a returned value is
 * not a trusted one just because we sent it: nothing stops a caller posting
 * `products/<someone-elses-product>/…` — or any string at all — to the confirm
 * endpoint. Checking the shape here means a ProductImage row can only ever
 * point inside its own product's prefix, which is what makes the productId in
 * a key meaningful rather than decorative.
 *
 * Prefix comparison rather than an interpolated regex, so the productId is
 * never treated as a pattern.
 */
export function isImageKeyFor(productId: string, key: string) {
  const prefix = `products/${productId}/`;
  if (!key.startsWith(prefix)) return false;
  return IMAGE_FILENAME_PATTERN.test(key.slice(prefix.length));
}

// ---------------------------------------------------------------------------
// Object lifecycle
// ---------------------------------------------------------------------------

/**
 * Is the object actually in the bucket?
 *
 * What separates "confirm the upload" from "take the client's word for it".
 * The browser PUTs directly to R2, so our server never sees the transfer
 * succeed or fail — without this, a confirm sent after a failed or abandoned
 * PUT writes a row whose <img> is permanently broken on the storefront.
 *
 * R2 is strongly consistent, so a HEAD immediately after a successful PUT
 * sees the object.
 */
export async function imageObjectExists(key: string) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (error) {
    // The SDK models a 404 as this error class; anything else (credentials,
    // network, a 500 from R2) is a real failure and must not be reported as
    // "the object isn't there".
    if (error instanceof NotFound) return false;
    throw error;
  }
}

/**
 * Remove the object. Idempotent — S3/R2 answer 204 for a key that is already
 * gone, so a retried delete is not an error.
 */
export async function deleteImageObject(key: string) {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

/**
 * Remove every object belonging to one product.
 *
 * Deleting a product cascades its ProductImage rows in Postgres, but Postgres
 * has never heard of Cloudflare — without this, the files stayed in the bucket
 * forever: invisible, unreferenced, and billable.
 *
 * BY PREFIX, not by the keys we read beforehand. Every key this app issues is
 * `products/<productId>/<uuid>.<ext>` (see buildImageKey), so one prefix names
 * exactly the objects belonging to one product. Three things follow:
 *
 *   - It cannot miss an object because of a race. Reading the image rows and
 *     then deleting the files leaves a window where a confirm lands in
 *     between; the row is cascaded away and its key is never seen. The prefix
 *     does not care when the object arrived.
 *   - It sweeps up objects already orphaned by deletes that happened before
 *     this function existed.
 *   - It is one LIST and one batched DELETE rather than N round trips.
 *
 * Paginated because ListObjectsV2 caps at 1000 keys per page, and
 * DeleteObjects at 1000 per call — the same bound, so one page maps to one
 * delete. Returns how many objects were removed.
 */
export async function deleteProductObjects(productId: string) {
  const prefix = `products/${productId}/`;
  let removed = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = (listed.Contents ?? []).flatMap((object) =>
      object.Key ? [{ Key: object.Key }] : [],
    );

    if (objects.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          // Quiet: only failures come back, which is all we would act on.
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      removed += objects.length;
    }

    continuationToken = listed.IsTruncated
      ? listed.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return removed;
}
