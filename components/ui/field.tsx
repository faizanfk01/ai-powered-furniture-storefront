import type { ReactNode } from "react";

/**
 * The shared look of a form control.
 *
 * A string rather than a component wrapping every input, so a <select>, an
 * <input> and a <textarea> can each stay themselves — they take different
 * props and behave differently, and hiding that behind one polymorphic
 * component buys nothing.
 *
 * Square, hairline, no radius: the same geometry as the buttons, the cards and
 * the footprint plans. Extracted because it is now used by the catalogue
 * filters and both form pages, and three copies of a border colour drift.
 */
export const controlClass =
  "w-full border border-hairline bg-paper px-4 py-3 font-body text-ink placeholder:text-muted/60 " +
  "focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass";

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
      <label htmlFor={id} className="spec-label block text-muted">
        {label}
        {optional && <span className="ml-2 text-muted/60">Optional</span>}
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
