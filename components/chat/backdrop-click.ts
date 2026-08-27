import type { MouseEvent } from "react";

/**
 * Did this click land on the scrim rather than inside the dialog?
 *
 * A dialog's backdrop is not a child element — a click on it targets the
 * <dialog> itself, so `event.target === event.currentTarget` is true for both
 * "clicked the scrim" and "clicked the dialog's own padding". The only way to
 * separate them is to ask whether the point was outside the dialog's box.
 *
 * Shared by both AI containers, in its own module rather than exported from
 * one of them: the centred modal importing from the drawer would be a
 * dependency between two things that are meant to be alternatives.
 */
export function isBackdropClick(event: MouseEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false;

  const box = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}
