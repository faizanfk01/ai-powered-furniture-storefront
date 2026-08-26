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
 * Map one non-2xx response to per-field messages.
 *
 * TWO CODES CARRY NO PATH and have to be attributed by what the schema makes
 * possible, rather than by what the response says:
 *
 *   CONFLICT (409) — a unique constraint. `slug` is the only unique column on
 *   Product, so a conflict is always the slug. If a second unique field is
 *   ever added, this mapping becomes wrong and the API would need to name the
 *   field; the assumption is asserted here rather than left implicit.
 *
 *   INVALID_REFERENCE (400) — a foreign key. `categoryId` is Product's only
 *   one, by the same reasoning.
 *
 * Both are far better attributed than not: "A product with the slug
 * 'karachi-sofa' already exists" belongs under the slug input, where the fix
 * is, not in a banner at the top of a long form.
 */
export function mapApiError(status: number, body: unknown): FormErrorState {
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

    case "CONFLICT":
      add(fieldErrors, "slug", message);
      return { fieldErrors, formError: null };

    case "INVALID_REFERENCE":
      add(fieldErrors, "categoryId", message);
      return { fieldErrors, formError: null };

    case "UNAUTHORIZED":
      return {
        fieldErrors: {},
        formError: `${message}. Your session may have expired — sign in again and resubmit.`,
      };

    // NOT_FOUND, INVALID_JSON, INTERNAL_ERROR and anything added later. Shown
    // verbatim rather than reworded: the API's message is more specific than
    // anything this layer could invent, and swallowing it is the one outcome
    // that must not happen.
    default:
      return { fieldErrors: {}, formError: message };
  }
}
