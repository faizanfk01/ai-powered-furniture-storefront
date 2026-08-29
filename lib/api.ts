import { NextResponse } from "next/server";
import type { z } from "zod";

import { auth } from "@/auth";

import { Prisma } from "./generated/prisma/client";
import { rateLimitHeaders, type RateLimitVerdict } from "./rate-limit";

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
  | "INVALID_REFERENCE"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  // The AI layer's two failure modes (Phase 3). Separate codes rather than one
  // "AI_ERROR" because the UI says different things: AI_BUSY is "try again in
  // a moment", AI_UNAVAILABLE is "don't wait for us, message WhatsApp". Both
  // are expected operating states of a free-tier upstream, so neither is an
  // INTERNAL_ERROR — a 500 here would mean a bug on our side, and it isn't.
  | "AI_BUSY"
  | "AI_UNAVAILABLE"
  // A generated draft was refused because it said something the source data
  // does not support (Phase 3 Step 3). 422 rather than 400: the request was
  // well-formed and the caller did nothing wrong — the content could not be
  // processed. Distinct from AI_UNAVAILABLE because the fix is different, and
  // the admin screen says so: regenerate, do not wait.
  | "AI_UNGROUNDED"
  // 429 from our own per-IP limiter (lib/rate-limit.ts). Deliberately NOT
  // AI_BUSY: that code means an upstream refused us and the caller did nothing
  // wrong, this one means the caller is the problem. /api/chat is the one
  // exception and reuses AI_BUSY on purpose — see the note in its route.
  | "RATE_LIMITED";

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

/**
 * 429 for a caller who has exceeded a per-IP limit.
 *
 * Carries `retry-after` so a client can wait the right amount rather than
 * guessing, plus the advisory `ratelimit-*` headers. The message is passed in
 * rather than generated here: "slow down" means something different to a
 * visitor writing a review than to an admin uploading photos, and the endpoint
 * is the only place that knows which one is reading it.
 */
export function rateLimited(message: string, verdict: RateLimitVerdict) {
  const response = apiError(429, "RATE_LIMITED", message);

  response.headers.set("retry-after", String(verdict.retryAfterSeconds));
  for (const [name, value] of Object.entries(rateLimitHeaders(verdict))) {
    response.headers.set(name, value);
  }

  return response;
}

/**
 * 400 with a flat list of field errors — `path` is "" for root-level issues.
 * `message` is overridable so a bad query parameter doesn't report itself as
 * a body problem.
 */
export function validationFailed(
  error: z.ZodError,
  message = "The request body failed validation",
) {
  return apiError(
    400,
    "VALIDATION_FAILED",
    message,
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  );
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Guard for a mutating handler. Returns a 401 response to return as-is, or
 * `null` when the caller is a signed-in admin:
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 *
 * Returning the response rather than throwing keeps handlers flat and makes
 * the guard visible at the top of each one — nothing is protected by a
 * mechanism a reader of the file cannot see.
 *
 * WHY THIS EXISTS ALONGSIDE proxy.ts: the proxy matches on path, and these
 * routes have no admin-only path to match. `/api/products` is a public GET
 * and an admin-only POST at the same URL, so protection has to be decided per
 * method, inside the handler.
 *
 * There is exactly one admin account, so being authenticated *is* being
 * authorized. If a second role ever appears, this is the single place that
 * has to learn the difference.
 */
export async function requireAdmin(): Promise<NextResponse<ApiErrorBody> | null> {
  const session = await auth();

  if (!session?.user) {
    return apiError(401, "UNAUTHORIZED", "Authentication required");
  }

  return null;
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
  /**
   * The write points at a row that does not exist — e.g. a product created
   * with a categoryId nobody owns. A client mistake in the body, so 400.
   */
  missingReference?: string;
  /**
   * Something still points at the row being deleted (onDelete: Restrict).
   * The body is fine; the current state of the data refuses it, so 409.
   */
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
      // P2003 — Postgres foreign key violation (SQLSTATE 23503). In this
      // schema that is always the insert/update direction: the row you
      // referenced isn't there. The delete direction is RESTRICT and arrives
      // as P2039 below, so the two never collide. `inUse` is still honoured as
      // a fallback for any relation added later without RESTRICT, where a
      // blocked delete would surface here instead.
      case "P2003": {
        if (expected.missingReference) {
          return apiError(400, "INVALID_REFERENCE", expected.missingReference);
        }
        if (expected.inUse) {
          return apiError(409, "CONFLICT", expected.inUse);
        }
        break;
      }
      // P2014 — the same "something still refers to this row" caught on
      // Prisma's side of the relation rather than Postgres'.
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
