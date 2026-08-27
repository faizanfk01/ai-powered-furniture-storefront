"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, storefrontControlClass } from "@/components/ui/field";
import { mapApiError, NO_ERRORS, type FormErrorState } from "@/lib/form-errors";

/**
 * Leaving a review.
 *
 * Posts to the existing POST /api/reviews from Phase 2 and nothing else. That
 * endpoint sets `status: PENDING` itself and reviewCreateSchema has no
 * `status` field at all, so there is deliberately nothing here that could ask
 * for a review to be published — the client cannot request it, and this form
 * does not try.
 *
 * WHICH MEANS THE SUCCESS MESSAGE HAS TO SAY SO. A submitted review is not a
 * published review; somebody at the shop reads it first. "Thanks, your review
 * is live" would be a lie told at the exact moment a customer is trusting us,
 * and it would be found out the moment they looked for it. So the confirmation
 * names the moderation step plainly.
 *
 * Per-field errors come from the API's own response via mapApiError(), the
 * same path the admin forms use: the server already knows which field it
 * rejected and why, and a banner reading "validation failed" throws that away.
 */

type Values = { authorName: string; rating: number; body: string };

const EMPTY: Values = { authorName: "", rating: 0, body: "" };

/** Focus order for jumping to the first rejected field. */
const FIELD_ORDER = ["rating", "authorName", "body"] as const;

const BODY_LIMIT = 2000;

export function ReviewForm({
  productId,
  productName,
}: {
  /** Omitted for a general store review — the column is nullable. */
  productId?: string;
  /** Only for the heading. The id is what the API actually stores. */
  productName?: string;
}) {
  const formId = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<FormErrorState>(NO_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fieldId = (name: string) => `${formId}-${name}`;

  /** Clearing a field's error as it is edited — a message under a field the
   *  customer has already fixed reads as "still wrong". */
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
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Exactly the four fields reviewCreateSchema accepts. No `status`:
        // there is no such field to send, and adding one would be the bug the
        // schema's own comment warns about.
        body: JSON.stringify({
          authorName: values.authorName,
          rating: values.rating,
          body: values.body,
          productId: productId ?? null,
        }),
      });

      if (!response.ok) {
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          // Falls through to mapApiError's unexpected-response branch.
        }

        // No conflictField or referenceField: a bad productId is not something
        // the customer typed or can fix, so it belongs in the banner rather
        // than pinned to an input that does not exist on this form.
        const mapped = mapApiError(response.status, body);
        setErrors(mapped);

        const firstBad = FIELD_ORDER.find((field) => mapped.fieldErrors[field]);
        if (firstBad) document.getElementById(fieldId(firstBad))?.focus();
        return;
      }

      setValues(EMPTY);
      setSubmitted(true);
    } catch (cause) {
      setErrors({
        fieldErrors: {},
        formError:
          cause instanceof Error
            ? `Could not send your review: ${cause.message}. Please try again.`
            : "Could not send your review. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card padded className="sm:p-8">
        <h3 className="display-wide text-xl font-semibold">
          Thank you — it&rsquo;s with us
        </h3>

        {/* The honest part. Named as a step with a person in it, not as a
            vague delay, because "awaiting approval" is what is actually
            happening and a customer looking for their words tomorrow should
            know why they are not there yet. */}
        <p className="mt-3 leading-relaxed text-muted">
          Your review has been sent and is{" "}
          <strong className="font-semibold text-ink">awaiting approval</strong>{" "}
          before it appears on the site. Someone at the shop reads every review
          first, so it will not show up straight away.
        </p>

        <Button
          type="button"
          variant="outline"
          onClick={() => setSubmitted(false)}
          className="mt-6"
        >
          Write another
        </Button>
      </Card>
    );
  }

  return (
    <Card padded className="sm:p-8">
      <form onSubmit={handleSubmit} noValidate>
        <h3 className="display-wide text-xl font-semibold">
          {productName
            ? `Reviewed the ${productName}?`
            : "Been to the showroom?"}
        </h3>
        <p className="mt-2 text-sm text-muted">
          Every review is read by someone at the shop before it appears here.
        </p>

      {errors.formError && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-brass/40 bg-accent-soft px-3.5 py-3 text-sm leading-relaxed text-ink"
        >
          {errors.formError}
        </p>
      )}

      <div className="mt-6 space-y-5">
        <StarRating
          id={fieldId("rating")}
          value={values.rating}
          errors={errors.fieldErrors.rating}
          onChange={(rating) => {
            setValues((current) => ({ ...current, rating }));
            clearError("rating");
          }}
        />

        <Field id={fieldId("authorName")} label="Your name">
          <input
            id={fieldId("authorName")}
            name="authorName"
            type="text"
            autoComplete="name"
            maxLength={80}
            value={values.authorName}
            onChange={(event) => {
              setValues((current) => ({
                ...current,
                authorName: event.target.value,
              }));
              clearError("authorName");
            }}
            aria-invalid={errors.fieldErrors.authorName ? true : undefined}
            aria-describedby={
              errors.fieldErrors.authorName
                ? `${fieldId("authorName")}-error`
                : undefined
            }
            className={controlWithError(Boolean(errors.fieldErrors.authorName))}
          />
          <FieldErrors
            id={`${fieldId("authorName")}-error`}
            messages={errors.fieldErrors.authorName}
          />
        </Field>

        <Field id={fieldId("body")} label="Your review">
          <textarea
            id={fieldId("body")}
            name="body"
            rows={5}
            maxLength={BODY_LIMIT}
            value={values.body}
            onChange={(event) => {
              setValues((current) => ({ ...current, body: event.target.value }));
              clearError("body");
            }}
            placeholder={
              productName
                ? "How does it look and feel in your home?"
                : "What did you come in for, and how did it go?"
            }
            aria-invalid={errors.fieldErrors.body ? true : undefined}
            aria-describedby={
              errors.fieldErrors.body ? `${fieldId("body")}-error` : undefined
            }
            className={`${controlWithError(Boolean(errors.fieldErrors.body))} resize-y`}
          />
          <FieldErrors
            id={`${fieldId("body")}-error`}
            messages={errors.fieldErrors.body}
          />
          {/* Only once it is close enough to matter. A counter that watches
              from the first character is noise on a field almost nobody fills. */}
          {values.body.length > BODY_LIMIT - 200 && (
            <p className="mt-2 text-sm text-muted">
              {BODY_LIMIT - values.body.length} characters left
            </p>
          )}
        </Field>
      </div>

        <Button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full sm:w-auto"
        >
          {submitting ? "Sending…" : "Send review"}
        </Button>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------

/**
 * The storefront control, with the border swapped when the server rejected the
 * field.
 *
 * IT REPLACES THE BORDER UTILITIES, IT DOES NOT APPEND ONE. Appending
 * `border-accent-strong` after the shared class left two border-color
 * utilities on the element, and Tailwind resolves that by CSS source order,
 * not by the order they were written into the string — `border-line-strong`
 * won, and a rejected field kept its resting border while the message
 * underneath said something was wrong. The same trap the chat drawer's
 * `display` rule documents in app/globals.css.
 *
 * Derived from the shared class rather than restated, so a change to the
 * control's padding or radius still cannot miss the error variant.
 */
function controlWithError(invalid: boolean) {
  if (!invalid) return storefrontControlClass;

  return storefrontControlClass
    .replace("border-line-strong", "border-accent-strong")
    .replace("hover:border-muted/50", "hover:border-accent-strong")
    .replace("focus:border-ink", "focus:border-accent-strong");
}

function FieldErrors({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;

  return (
    <p id={id} role="alert" className="mt-2 text-sm text-accent-strong">
      {messages.join(" ")}
    </p>
  );
}

/**
 * The rating input: five radios that look like stars.
 *
 * REAL RADIOS, visually hidden, rather than five buttons with click handlers.
 * A radio group is what this is — one choice from a fixed set — and using the
 * real control means arrow-key navigation, the group being announced as
 * "1 of 5", and form semantics all arrive without being reimplemented. The
 * button version of this is the one that ends up unreachable by keyboard.
 *
 * `peer-checked` cannot express "this star and every star before it", so the
 * fill is driven from the current value in JS. The hover preview is CSS only —
 * `group-hover/star` on each label lights the ones up to it.
 */
function StarRating({
  id,
  value,
  errors,
  onChange,
}: {
  id: string;
  value: number;
  errors?: string[];
  onChange: (rating: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink">Your rating</legend>

      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((mark) => (
          <label
            key={mark}
            className="group/star cursor-pointer p-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brass"
          >
            <input
              // The first radio carries the group's id so the error jump and
              // the legend land on something focusable.
              id={mark === 1 ? id : `${id}-${mark}`}
              type="radio"
              name={id}
              value={mark}
              checked={value === mark}
              onChange={() => onChange(mark)}
              className="sr-only"
            />
            <span className="sr-only">
              {mark} star{mark === 1 ? "" : "s"}
            </span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className={`size-7 transition-colors ${
                mark <= value ? "fill-brass" : "fill-hairline"
              }`}
            >
              <path d="M12 2.5l2.9 6.06 6.6.9-4.8 4.6 1.2 6.56L12 17.5l-5.9 3.12 1.2-6.56-4.8-4.6 6.6-.9z" />
            </svg>
          </label>
        ))}

        <span aria-hidden="true" className="tabular ml-2 text-sm text-muted">
          {value > 0 ? `${value} / 5` : "—"}
        </span>
      </div>

      <FieldErrors id={`${id}-error`} messages={errors} />
    </fieldset>
  );
}
