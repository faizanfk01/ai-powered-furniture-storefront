import type { ApiErrorBody } from "./api";

/**
 * Turning an API error response into messages that sit next to the field that
 * caused them.
 *
 * This is the whole usability argument of the admin forms. A banner saying
 * "The request body failed validation" tells the owner that something is
 * wrong; a message under the price field saying "Price must be greater than
 * zero" tells them what to do. The API already knows which field it rejected —
 * throwing that away at the UI layer is the failure this module exists to
 * prevent.
 *
 * Pure, and separate from React, so the mapping can be exercised directly
 * against real API responses rather than by clicking through a form.
 */

export type FieldErrors = Record<string, string[]>;

export type FormErrorState = {
  /** Keyed by field name — "name", "slug", "price", … */
  fieldErrors: FieldErrors;
  /** Anything that does not belong to one field. Rendered above the form. */
  formError: string | null;
};

export const NO_ERRORS: FormErrorState = { fieldErrors: {}, formError: null };

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as ApiErrorBody).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}

function add(fieldErrors: FieldErrors, field: string, message: string) {
  (fieldErrors[field] ??= []).push(message);
}

/**
 * Where a code with no `path` should be shown.
 *
 * CONFLICT and INVALID_REFERENCE name no field, so the CALLER says which of
 * its own fields could have caused one. That is deliberately not a default:
 * the same 409 means "duplicate slug" when submitting a form and "still has
 * products" when deleting a category, and a mapper that guessed would file the
 * second one under the slug input — which is exactly the bug this parameter
 * exists to prevent. A caller that names nothing gets a banner, which is
 * always honest if less precise.
 */
export type ConflictMapping = {
  /** Field to blame for a 409. Forms pass "slug"; delete buttons pass nothing. */
  conflictField?: string;
  /** Field to blame for a 400 INVALID_REFERENCE — a foreign key. */
  referenceField?: string;
};

/**
 * Map one non-2xx response to per-field messages.
 *
 * A message attributed to its field is worth far more than a banner: "A
 * product with the slug 'karachi-sofa' already exists" belongs under the slug
 * input, where the fix is, not at the top of a long form. But attribution has
 * to be earned — see ConflictMapping above.
 */
export function mapApiError(
  status: number,
  body: unknown,
  mapping: ConflictMapping = {},
): FormErrorState {
  if (!isApiErrorBody(body)) {
    return {
      fieldErrors: {},
      formError: `The server returned an unexpected ${status} response.`,
    };
  }

  const { code, message, issues } = body.error;
  const fieldErrors: FieldErrors = {};

  switch (code) {
    case "VALIDATION_FAILED": {
      // The API sends one issue per rejected field, with `path` already
      // flattened to a dotted string.
      for (const issue of issues ?? []) {
        if (issue.path) add(fieldErrors, issue.path, issue.message);
        else add(fieldErrors, "__form", issue.message);
      }

      const rootIssues = fieldErrors.__form;
      delete fieldErrors.__form;

      return {
        fieldErrors,
        // Only fall back to the generic message when nothing could be
        // attributed — otherwise the banner just repeats what the fields say.
        formError:
          rootIssues?.join(" ") ??
          (Object.keys(fieldErrors).length === 0 ? message : null),
      };
    }

    case "CONFLICT": {
      if (!mapping.conflictField) return { fieldErrors: {}, formError: message };
      add(fieldErrors, mapping.conflictField, message);
      return { fieldErrors, formError: null };
    }

    case "INVALID_REFERENCE": {
      if (!mapping.referenceField) return { fieldErrors: {}, formError: message };
      add(fieldErrors, mapping.referenceField, message);
      return { fieldErrors, formError: null };
    }

    case "UNAUTHORIZED":
      return {
        fieldErrors: {},
        formError: `${message}. Your session may have expired — sign in again and resubmit.`,
      };

    // NOT_FOUND, INVALID_JSON, INTERNAL_ERROR, RATE_LIMITED and anything added
    // later. Shown verbatim rather than reworded: the API's message is more
    // specific than anything this layer could invent, and swallowing it is the
    // one outcome that must not happen.
    //
    // RATE_LIMITED lands here deliberately rather than in a case of its own.
    // The route already builds the whole sentence including the wait ("try
    // again in about 45 minutes"), and it names no field — a banner is exactly
    // right, and a dedicated case would only restate this branch.
    default:
      return { fieldErrors: {}, formError: message };
  }
}
