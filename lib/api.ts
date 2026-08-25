import { NextResponse } from "next/server";
import type { z } from "zod";

import { Prisma } from "./generated/prisma/client";

// ---------------------------------------------------------------------------
// Error shape
// ---------------------------------------------------------------------------
//
// Every non-2xx response from the API has this body and nothing else, so a
// caller can branch on `error.code` without sniffing the status text:
//
//   { "error": { "code": "CONFLICT", "message": "…", "issues": [ … ] } }
//
// `issues` is only present on VALIDATION_FAILED.

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_JSON"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    issues?: { path: string; message: string }[];
  };
};

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  issues?: ApiErrorBody["error"]["issues"],
) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, ...(issues ? { issues } : {}) } },
    { status },
  );
}

export function notFound(message = "Not found") {
  return apiError(404, "NOT_FOUND", message);
}

/** 400 with a flat list of field errors — `path` is "" for root-level issues. */
export function validationFailed(error: z.ZodError) {
  return apiError(
    400,
    "VALIDATION_FAILED",
    "The request body failed validation",
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}

// ---------------------------------------------------------------------------
// Request body parsing
// ---------------------------------------------------------------------------

/**
 * `request.json()` throws on a malformed or empty body, which would otherwise
 * surface as an unhandled 500 for what is squarely a client mistake.
 *
 * Returns a discriminated result rather than throwing so callers stay flat:
 *   const body = await readJson(request);
 *   if (!body.ok) return body.response;
 */
export async function readJson(
  request: Request,
): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse<ApiErrorBody> }
> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return {
      ok: false,
      response: apiError(400, "INVALID_JSON", "Request body is not valid JSON"),
    };
  }
}

// ---------------------------------------------------------------------------
// Prisma error mapping
// ---------------------------------------------------------------------------

/**
 * Messages for the failure modes a handler expects. Anything not named here
 * falls through to a logged 500 — an unexpected database error should look
 * like a bug, not like a tidy 4xx.
 */
type ExpectedFailures = {
  /** A unique constraint rejected the write (here: a duplicate slug). */
  conflict?: string;
  /** A foreign key still points at this row (onDelete: Restrict). */
  inUse?: string;
  /** The row the operation targeted does not exist. */
  notFound?: string;
};

/**
 * Postgres SQLSTATE for `restrict_violation` — what `ON DELETE RESTRICT`
 * raises. Distinct from 23503 `foreign_key_violation`, which is what you get
 * when an *insert* points at a row that isn't there.
 */
const PG_RESTRICT_VIOLATION = "23001";

/**
 * Prisma 7's driver adapters classify most Postgres errors into P-codes, but
 * not all of them: an unclassified one arrives as P2039 with the raw driver
 * error tucked into `meta.driverAdapterError.cause`. `restrict_violation` is
 * one of the unclassified ones, so reaching the SQLSTATE is the only way to
 * recognise it. Verified against @prisma/adapter-pg 7.9.1 — if a later version
 * starts mapping 23001 to P2003, the P2003 branch below already covers it.
 */
function driverSqlState(error: Prisma.PrismaClientKnownRequestError) {
  const meta = error.meta as
    | { driverAdapterError?: { cause?: { code?: unknown } } }
    | undefined;
  const code = meta?.driverAdapterError?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

export function handleApiError(error: unknown, expected: ExpectedFailures = {}) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // P2002 — unique constraint.
      case "P2002": {
        if (expected.conflict) {
          return apiError(409, "CONFLICT", expected.conflict);
        }
        break;
      }
      // P2003 is Postgres' foreign key violation; P2014 is the same situation
      // caught on Prisma's side of the relation. Both mean "something still
      // refers to this row".
      case "P2003":
      case "P2014": {
        if (expected.inUse) {
          return apiError(409, "CONFLICT", expected.inUse);
        }
        break;
      }
      // P2039 — unclassified driver error. Only a RESTRICT violation is
      // recognised here; anything else genuinely is a 500.
      case "P2039": {
        if (expected.inUse && driverSqlState(error) === PG_RESTRICT_VIOLATION) {
          return apiError(409, "CONFLICT", expected.inUse);
        }
        break;
      }
      // P2025 — the targeted row does not exist.
      case "P2025": {
        return notFound(expected.notFound ?? "Not found");
      }
    }
  }

  console.error("[api] unhandled error", error);
  return apiError(500, "INTERNAL_ERROR", "Something went wrong");
}
