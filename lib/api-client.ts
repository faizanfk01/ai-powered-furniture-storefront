import type { ApiErrorBody } from "./api";

/**
 * Reading a failed response's own words.
 *
 * Every non-2xx from this API carries { error: { code, message, issues? } }.
 * Anything that does not is from outside it — the dev server, a proxy, R2 —
 * and then the status line is all there is.
 *
 * Exists so no call site has to remember the envelope shape, and so no call
 * site is tempted to write "Something went wrong" over a message that said
 * exactly what was wrong.
 */
export async function describeApiFailure(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body?.error) {
      const issues = body.error.issues?.length
        ? ` (${body.error.issues
            .map((issue) => `${issue.path || "body"}: ${issue.message}`)
            .join("; ")})`
        : "";
      return `${body.error.code}: ${body.error.message}${issues}`;
    }
  } catch {
    // Fall through to the status line.
  }

  return `${response.status} ${response.statusText}`.trim();
}
