import type { ReactNode } from "react";

/**
 * The shared look of a form control.
 *
 * A string rather than a component wrapping every input, so a <select>, an
 * <input> and a <textarea> can each stay themselves — they take different
 * props and behave differently, and hiding that behind one polymorphic
 * component buys nothing.
 *
 * THIS IS NOW THE ADMIN CONTROL. Square, hairline, no radius — the geometry of
 * the showroom identity. It is left exactly as it was because the dashboard
 * forms and the login page use it, and the admin is deliberately a different
 * surface from the storefront (see the note in app/(storefront)/layout.tsx).
 * Restyling it here would convert the dashboard as a side effect of a
 * storefront pass.
 */
export const controlClass =
  "w-full border border-hairline bg-paper px-4 py-3 font-body text-ink placeholder:text-muted/60 " +
  "focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

/**
 * The storefront control: rounded, a real edge, and the same 0.5rem radius the
 * Button and Card primitives settled on in 6a.
 *
 * `line-strong` rather than `hairline` on purpose. An input has to read as
 * something you can type into before it is focused, and the hairline that is
 * right for a divider disappears against white as a field boundary.
 *
 * A second export rather than a `variant` argument: these are two different
 * design systems that happen to live in one repo, and a function that picks
 * between them would invite call sites to pick wrong.
 */
export const storefrontControlClass =
  "w-full rounded-lg border border-line-strong bg-paper px-3.5 py-2.5 text-ink transition-colors " +
  "placeholder:text-muted/70 " +
  "hover:border-muted/50 focus:border-ink focus:outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

/**
 * Label, control, and an optional hint underneath.
 *
 * `htmlFor` is required rather than optional: a label that is not bound to its
 * control looks identical on screen and is useless to a screen reader, and
 * making it a parameter you must pass is the cheapest way to never forget it.
 */
export function Field({
  id,
  label,
  hint,
  optional = false,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  /** Marks the field as optional in the label, so the required ones need no mark. */
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      {/* Sentence case at a normal reading weight. The uppercase, letter-spaced
          label this replaces was showroom signage; on a storefront form the
          label is read as a question, not displayed as a plaque. */}
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {optional && (
          <span className="ml-2 font-normal text-muted">Optional</span>
        )}
      </label>

      <div className="mt-2">{children}</div>

      {hint && (
        <p id={`${id}-hint`} className="mt-2 text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
