import { z } from "zod";

// ---------------------------------------------------------------------------
// Upload policy
// ---------------------------------------------------------------------------
//
// The file never passes through our server — the browser PUTs it straight to
// R2 — so every rule about what may be stored has to be decided here, at
// URL-generation time, and then baked into the signature. Nothing downstream
// gets a second chance to say no.

/**
 * The only content types the bucket accepts. Photographs of furniture; there
 * is no reason for an admin to upload anything else, and each extra format is
 * another decoder the browser has to hand a stranger's bytes to.
 *
 * Deliberately no image/svg+xml: SVG is a document, not a picture. It can
 * carry <script>, and served from the same public origin as everything else it
 * would be stored XSS.
 */
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

/**
 * Extension for the stored object key. The `Record<ImageContentType, string>`
 * annotation is the point: add a type to the list above without giving it an
 * extension and this stops compiling, so an accepted upload can never reach
 * the key generator with nothing to name it.
 */
export const IMAGE_EXTENSIONS: Record<ImageContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 5 MB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Presign request
// ---------------------------------------------------------------------------

/**
 * What the browser must declare before it gets a URL.
 *
 * No filename field. The client's filename is never used for anything — not
 * the key, not the extension — so accepting one would only invite the mistake
 * of trusting it later. The extension comes from the content type, which is
 * signed into the URL and therefore actually enforced; a name like
 * "../../evil.jpg" has nowhere to go.
 *
 * `fileSize` is checked here AND signed into the presigned URL as
 * content-length, so this bound is not merely advisory — see presignImageUpload
 * in lib/r2.ts.
 */
export const imagePresignSchema = z.object({
  contentType: z.enum(IMAGE_CONTENT_TYPES, {
    error: `Image must be one of: ${IMAGE_CONTENT_TYPES.join(", ")}`,
  }),

  fileSize: z
    .int("File size must be a whole number of bytes")
    .positive("File size must be greater than zero")
    .max(MAX_IMAGE_BYTES, "Image must be 5 MB or smaller"),
});

export type ImagePresignInput = z.infer<typeof imagePresignSchema>;

// ---------------------------------------------------------------------------
// Confirm / record
// ---------------------------------------------------------------------------

/**
 * The body of POST /api/admin/products/[id]/images, sent after the browser's
 * PUT to R2 succeeds.
 *
 * `key` is the one field that carries real weight — the row's identity in the
 * bucket, and what DELETE later uses to remove the file. It is checked twice
 * in the handler beyond the length bound here: that it has the shape of a key
 * this server issued for this product (isImageKeyFor), and that the object is
 * genuinely in the bucket (imageObjectExists).
 *
 * There is deliberately no `url` field. It would be redundant with `key` and
 * the two could disagree — a row whose url points at one object and whose key
 * deletes another is a bug with no upside. The handler derives the url from
 * the key instead.
 */
export const productImageCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(512, "Key must be 512 characters or fewer"),

  /**
   * Alt text. Optional per the upload flow — an admin uploading five photos of
   * a sofa should not be blocked at the API by a copy-writing task — so it
   * defaults to "" rather than being required. Empty alt is also the correct
   * markup for a decorative image, so the default is honest rather than a
   * placeholder to clean up later.
   */
  alt: z
    .string()
    .trim()
    .max(200, "Alt text must be 200 characters or fewer")
    .optional()
    .default(""),

  /**
   * Position in the gallery. Absent means "put it last" — resolved in the
   * handler, which is the only place that knows what the product already has.
   * Prisma's schema default of 0 would instead stack every upload at the front
   * in an undefined order.
   */
  sortOrder: z
    .int("Sort order must be a whole number")
    .min(0, "Sort order cannot be negative")
    .max(10_000, "Sort order is implausibly large")
    .optional(),
});

export type ProductImageCreateInput = z.infer<typeof productImageCreateSchema>;
