"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { controlClass } from "@/components/ui/field";
import {
  mapApiError,
  NO_ERRORS,
  type FormErrorState,
} from "@/lib/form-errors";
import { slugify } from "@/lib/slugify";

type CategoryOption = { id: string; name: string };

export type ProductFormValues = {
  name: string;
  slug: string;
  categoryId: string;
  /** String, not number — an empty input is "" and must survive a round trip. */
  price: string;
  dimensions: string;
  description: string;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";
};

const STOCK_OPTIONS: { value: ProductFormValues["stockStatus"]; label: string }[] =
  [
    { value: "IN_STOCK", label: "In stock" },
    { value: "OUT_OF_STOCK", label: "Out of stock" },
    { value: "MADE_TO_ORDER", label: "Made to order" },
  ];

/** Focus order, for jumping to the first field the API rejected. */
const FIELD_ORDER = [
  "name",
  "slug",
  "categoryId",
  "price",
  "dimensions",
  "description",
  "stockStatus",
] as const;

const EMPTY: ProductFormValues = {
  name: "",
  slug: "",
  categoryId: "",
  price: "",
  dimensions: "",
  description: "",
  stockStatus: "IN_STOCK",
};

/**
 * The product form. One component, two modes.
 *
 * Create and edit differ in three things and nothing else: where it posts,
 * what it starts with, and whether the slug follows the name. A second
 * component would have duplicated seven fields and their error wiring for
 * that.
 *
 * VALIDATION LIVES IN THE API, not here. The browser gets `required` and
 * `type="number"` so the obvious mistakes are caught without a round trip, but
 * nothing in this file re-implements productCreateSchema. Two copies of a
 * rule is one copy that drifts, and the API's copy is the one that actually
 * guards the database — so the API is also what produces the messages the
 * owner reads.
 */
export function ProductForm({
  mode,
  categories,
  productId,
  initialValues,
}: {
  mode: "create" | "edit";
  categories: CategoryOption[];
  /** Required in edit mode — the id PATCH is sent to. */
  productId?: string;
  initialValues?: ProductFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(
    initialValues ?? EMPTY,
  );
  const [errors, setErrors] = useState<FormErrorState>(NO_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  /**
   * Does the slug still follow the name?
   *
   * Create starts true: a new product has no URL yet, so deriving one as the
   * owner types is pure convenience.
   *
   * Edit starts FALSE, deliberately. The slug of a saved product is a live
   * public URL — /products/karachi-3-seater-fabric-sofa — that may be in
   * search results and in WhatsApp messages already sent to customers.
   * Retyping the name to fix a typo must not silently break those links. In
   * edit mode changing the slug is available, but it has to be asked for.
   */
  const [slugFollowsName, setSlugFollowsName] = useState(mode === "create");

  const busy = submitting || isPending;

  function setField<K extends keyof ProductFormValues>(
    field: K,
    value: ProductFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));

    // Clear this field's error as soon as it is touched. Leaving a stale
    // message under a field the owner has already fixed reads as "still
    // wrong" and sends them looking for a second problem.
    setErrors((current) => {
      if (!current.fieldErrors[field]) return current;
      const next = { ...current.fieldErrors };
      delete next[field];
      return { ...current, fieldErrors: next };
    });
  }

  function handleNameChange(name: string) {
    setValues((current) => ({
      ...current,
      name,
      ...(slugFollowsName ? { slug: slugify(name) } : {}),
    }));
    setErrors((current) => {
      const next = { ...current.fieldErrors };
      delete next.name;
      if (slugFollowsName) delete next.slug;
      return { ...current, fieldErrors: next };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setErrors(NO_ERRORS);

    // Sent as the API's types, not the form's. `price` is an integer column;
    // an empty dimensions field is null, not "" — the schema folds "" to null
    // anyway, but sending the value we mean keeps the request honest.
    const payload = {
      name: values.name,
      slug: values.slug,
      categoryId: values.categoryId,
      price: values.price === "" ? undefined : Number(values.price),
      dimensions: values.dimensions.trim() === "" ? null : values.dimensions,
      description: values.description,
      stockStatus: values.stockStatus,
    };

    try {
      const response = await fetch(
        mode === "create" ? "/api/products" : `/api/products/${productId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // Not JSON — mapApiError falls back to the status.
        }

        const mapped = mapApiError(response.status, body);
        setErrors(mapped);

        // Send the cursor to the first rejected field. On a form this long the
        // error can otherwise be below the fold, and the submit button looks
        // like it did nothing.
        const firstBad = FIELD_ORDER.find((field) => mapped.fieldErrors[field]);
        if (firstBad) document.getElementById(firstBad)?.focus();
        return;
      }

      // The list is a Server Component reading the database, so it has to be
      // told the data changed.
      startTransition(() => {
        router.push("/admin/products");
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

  // No categories, no product: Product.categoryId is non-null with an FK, so
  // a submission could only ever 400. Better to say so than to render a form
  // whose every attempt fails.
  if (categories.length === 0) {
    return (
      <div className="max-w-2xl border border-hairline p-6">
        <p className="spec-label text-brass">No categories yet</p>
        <h2 className="display-wide mt-3 text-xl font-medium uppercase">
          Create a category first
        </h2>
        <p className="mt-3 leading-relaxed text-muted">
          Every product belongs to a category, and there are none to choose
          from. Category management arrives in the next sub-phase; until then a
          category can be created with{" "}
          <span className="font-mono text-ink">POST /api/categories</span>.
        </p>
        <Link
          href="/admin/products"
          className="mt-6 inline-block text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
        >
          ← Back to products
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-3xl">
      {errors.formError && (
        <p
          role="alert"
          className="mb-6 border border-brass/50 bg-brass/10 p-3 text-sm text-ink"
        >
          {errors.formError}
        </p>
      )}

      <div className="flex flex-col gap-5">
        <FormField
          id="name"
          label="Name"
          errors={errors.fieldErrors.name}
          hint="Shown on the catalogue card and the product page."
        >
          {(props) => (
            <input
              {...props}
              type="text"
              value={values.name}
              onChange={(event) => handleNameChange(event.target.value)}
              maxLength={160}
              className={controlClass}
            />
          )}
        </FormField>

        <FormField
          id="slug"
          label="Slug"
          errors={errors.fieldErrors.slug}
          hint={
            slugFollowsName
              ? "Generated from the name. Edit it to take control."
              : mode === "edit"
                ? "This is the product's public URL. Changing it breaks existing links."
                : "Set by hand."
          }
        >
          {(props) => (
            <>
              <input
                {...props}
                type="text"
                value={values.slug}
                onChange={(event) => {
                  setSlugFollowsName(false);
                  setField("slug", event.target.value);
                }}
                maxLength={96}
                className={`${controlClass} font-mono`}
              />
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                <span className="font-mono text-xs">
                  /products/{values.slug || "…"}
                </span>
                {!slugFollowsName && values.name.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlugFollowsName(true);
                      setField("slug", slugify(values.name));
                    }}
                    className="text-xs underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
                  >
                    Regenerate from name
                  </button>
                )}
              </p>
            </>
          )}
        </FormField>

        <FormField
          id="categoryId"
          label="Category"
          errors={errors.fieldErrors.categoryId}
        >
          {(props) => (
            <select
              {...props}
              value={values.categoryId}
              onChange={(event) => setField("categoryId", event.target.value)}
              className={controlClass}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField
          id="price"
          label="Price (PKR)"
          errors={errors.fieldErrors.price}
          hint="Whole rupees. No decimals — the catalogue does not use paisa."
        >
          {(props) => (
            <input
              {...props}
              type="number"
              inputMode="numeric"
              step={1}
              min={1}
              value={values.price}
              onChange={(event) => setField("price", event.target.value)}
              className={`${controlClass} font-mono`}
            />
          )}
        </FormField>

        <FormField
          id="dimensions"
          label="Dimensions"
          optional
          errors={errors.fieldErrors.dimensions}
          hint="Free text, in the catalogue's own notation. Used to draw the plan view when a product has no photograph."
        >
          {(props) => (
            <input
              {...props}
              type="text"
              value={values.dimensions}
              onChange={(event) => setField("dimensions", event.target.value)}
              placeholder={'84" W x 36" D x 32" H'}
              maxLength={120}
              className={`${controlClass} font-mono`}
            />
          )}
        </FormField>

        <FormField
          id="description"
          label="Description"
          errors={errors.fieldErrors.description}
          hint="The workshop's account of the piece — materials, construction, what it is for."
        >
          {(props) => (
            <textarea
              {...props}
              rows={7}
              value={values.description}
              onChange={(event) => setField("description", event.target.value)}
              maxLength={5000}
              className={`${controlClass} resize-y`}
            />
          )}
        </FormField>

        <FormField
          id="stockStatus"
          label="Availability"
          errors={errors.fieldErrors.stockStatus}
        >
          {(props) => (
            <select
              {...props}
              value={values.stockStatus}
              onChange={(event) =>
                setField(
                  "stockStatus",
                  event.target.value as ProductFormValues["stockStatus"],
                )
              }
              className={controlClass}
            >
              {STOCK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </FormField>
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
              ? "Create product"
              : "Save changes"}
        </button>

        <Link
          href="/admin/products"
          className="px-4 py-3 text-sm text-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-brass"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/**
 * Label, control, hint and errors, with the ARIA wiring done once.
 *
 * The control is a render prop rather than `children`, because the pieces that
 * have to reach it — `id`, `aria-invalid`, `aria-describedby` — are computed
 * from the error state. Passing them down means no field can be rendered
 * without them: a red border that a screen reader cannot see is not an error
 * message, it is a decoration.
 */
function FormField({
  id,
  label,
  hint,
  optional = false,
  errors,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
  errors?: string[];
  children: (props: {
    id: string;
    name: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}) {
  const invalid = Boolean(errors?.length);
  const describedBy =
    [hint && `${id}-hint`, invalid && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="spec-label block text-muted">
        {label}
        {optional && <span className="ml-2 text-muted/60">Optional</span>}
      </label>

      <div className="mt-2">
        {children({
          id,
          name: id,
          ...(invalid && { "aria-invalid": true as const }),
          ...(describedBy && { "aria-describedby": describedBy }),
        })}
      </div>

      {invalid && (
        <ul id={`${id}-error`} role="alert" className="mt-2 space-y-1">
          {errors!.map((message) => (
            <li key={message} className="text-sm text-brass">
              {message}
            </li>
          ))}
        </ul>
      )}

      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
