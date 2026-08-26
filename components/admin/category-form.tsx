"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { controlClass } from "@/components/ui/field";
import { mapApiError, NO_ERRORS, type FormErrorState } from "@/lib/form-errors";
import { slugify } from "@/lib/slugify";

export type CategoryFormValues = { name: string; slug: string };

const FIELD_ORDER = ["name", "slug"] as const;

/**
 * The category form — the product form's smaller sibling, two fields instead
 * of seven, and the same three rules:
 *
 *   - validation lives in the API, never duplicated here;
 *   - every error lands on the field that caused it, via mapApiError;
 *   - the slug follows the name on create and stops following on edit,
 *     because a saved category's slug is a live URL (/catalog?category=sofas)
 *     that may be linked from elsewhere.
 *
 * Not merged with ProductForm. They share the pattern and the helpers, not a
 * component: a single form that switched field sets on a `kind` prop would be
 * two forms in a trench coat, and every future field on either one would have
 * to explain itself to the other.
 */
export function CategoryForm({
  mode,
  categoryId,
  initialValues,
}: {
  mode: "create" | "edit";
  categoryId?: string;
  initialValues?: CategoryFormValues;
}) {
  const router = useRouter();

  const [values, setValues] = useState<CategoryFormValues>(
    initialValues ?? { name: "", slug: "" },
  );
  const [errors, setErrors] = useState<FormErrorState>(NO_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [slugFollowsName, setSlugFollowsName] = useState(mode === "create");

  const busy = submitting || isPending;

  function clearError(field: string) {
    setErrors((current) => {
      if (!current.fieldErrors[field]) return current;
      const next = { ...current.fieldErrors };
      delete next[field];
      return { ...current, fieldErrors: next };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors(NO_ERRORS);

    try {
      const response = await fetch(
        mode === "create" ? "/api/categories" : `/api/categories/${categoryId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: values.name, slug: values.slug }),
        },
      );

      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // Not JSON — mapApiError falls back to the status.
        }

        const mapped = mapApiError(response.status, body, { conflictField: "slug" });
        setErrors(mapped);

        const firstBad = FIELD_ORDER.find((field) => mapped.fieldErrors[field]);
        if (firstBad) document.getElementById(firstBad)?.focus();
        return;
      }

      startTransition(() => {
        router.push("/admin/categories");
        router.refresh();
      });
    } catch (cause) {
      setErrors({
        fieldErrors: {},
        formError:
          cause instanceof Error
            ? `Request failed: ${cause.message}`
            : "Request failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-xl">
      {errors.formError && (
        <p
          role="alert"
          className="mb-6 border border-brass/50 bg-brass/10 p-3 text-sm text-ink"
        >
          {errors.formError}
        </p>
      )}

      <div className="flex flex-col gap-5">
        <div>
          <label htmlFor="name" className="spec-label block text-muted">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={values.name}
            maxLength={60}
            aria-invalid={errors.fieldErrors.name ? true : undefined}
            aria-describedby={errors.fieldErrors.name ? "name-error" : undefined}
            onChange={(event) => {
              const name = event.target.value;
              setValues((current) => ({
                ...current,
                name,
                ...(slugFollowsName ? { slug: slugify(name) } : {}),
              }));
              clearError("name");
              if (slugFollowsName) clearError("slug");
            }}
            className={`${controlClass} mt-2`}
          />
          <FieldErrors id="name-error" messages={errors.fieldErrors.name} />
        </div>

        <div>
          <label htmlFor="slug" className="spec-label block text-muted">
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            value={values.slug}
            maxLength={96}
            aria-invalid={errors.fieldErrors.slug ? true : undefined}
            aria-describedby={errors.fieldErrors.slug ? "slug-error" : undefined}
            onChange={(event) => {
              setSlugFollowsName(false);
              setValues((current) => ({ ...current, slug: event.target.value }));
              clearError("slug");
            }}
            className={`${controlClass} mt-2 font-mono`}
          />
          <FieldErrors id="slug-error" messages={errors.fieldErrors.slug} />

          <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span className="font-mono text-xs">
              /catalog?category={values.slug || "…"}
            </span>
            {!slugFollowsName && values.name.trim() !== "" && (
              <button
                type="button"
                onClick={() => {
                  setSlugFollowsName(true);
                  setValues((current) => ({
                    ...current,
                    slug: slugify(current.name),
                  }));
                  clearError("slug");
                }}
                className="text-xs underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
              >
                Regenerate from name
              </button>
            )}
          </p>

          {mode === "edit" && (
            <p className="mt-2 text-sm text-muted">
              This slug appears in catalogue filter links. Changing it breaks
              any that have been shared.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-hairline pt-6">
        <button
          type="submit"
          disabled={busy}
          className="bg-ink px-6 py-3 font-display text-sm font-medium tracking-wide text-paper uppercase transition-colors hover:bg-ink-deep disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          {busy
            ? "Saving…"
            : mode === "create"
              ? "Create category"
              : "Save changes"}
        </button>

        <Link
          href="/admin/categories"
          className="px-4 py-3 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function FieldErrors({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    <ul id={id} role="alert" className="mt-2 space-y-1">
      {messages.map((message) => (
        <li key={message} className="text-sm text-brass">
          {message}
        </li>
      ))}
    </ul>
  );
}
