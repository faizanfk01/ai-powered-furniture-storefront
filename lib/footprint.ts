/**
 * Reading a footprint out of the free-form `dimensions` column.
 *
 * The column is deliberately free text (see schema.prisma) — an admin types
 * what the piece measures, in the vocabulary of the trade, and the seeded rows
 * already show three variations: `28" W x 30" D x 34" H`, the bed's
 * `84" W x 80" L x 48" H` where length stands in for depth, and the desks'
 * trailing `71" W x 32" D x 30" H (desk)` where the string describes only part
 * of a set.
 *
 * So this parses opportunistically and refuses confidently. A footprint drawn
 * from a half-read string is worse than no footprint: it is a picture of a
 * piece of furniture that does not exist, and nothing downstream can tell it
 * from a correct one.
 */

export type Footprint = {
  /** Inches across the front. */
  width: number;
  /** Inches front-to-back. `L` is accepted for beds, which are quoted as length. */
  depth: number;
  /** Inches floor-to-top, when the string carries it. Not needed to draw a plan. */
  height?: number;
};

/**
 * Matches `84"` / `84 in` / `84` followed by an axis letter. The quote and the
 * spacing are both optional because neither is reliably typed.
 */
const AXIS_PATTERN = /(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b)?\s*([WDLH])\b/gi;

/**
 * A plausible piece of furniture, in inches. The bounds are here to catch a
 * misread rather than to police the catalogue: 0.5" would draw an invisible
 * sliver and 400" a rectangle that breaks the grid, and both mean the string
 * was not what we thought it was.
 */
const MIN_INCHES = 4;
const MAX_INCHES = 240;

function plausible(value: number | undefined): value is number {
  return value !== undefined && value >= MIN_INCHES && value <= MAX_INCHES;
}

/**
 * Returns null when the string does not yield a width AND a depth — including
 * when it is null, empty, prose, or quotes only a height. Callers must handle
 * the null; there is no "best guess" return.
 */
export function parseFootprint(input: string | null | undefined): Footprint | null {
  if (!input) return null;

  const axes = new Map<string, number>();
  for (const match of input.matchAll(AXIS_PATTERN)) {
    const axis = match[2]!.toUpperCase();
    // First occurrence wins: `71" W x 32" D x 30" H (desk)` describes the desk
    // first, and a second set of numbers later in the string is a different
    // object, not a correction of this one.
    if (!axes.has(axis)) axes.set(axis, Number(match[1]));
  }

  const width = axes.get("W");
  const depth = axes.get("D") ?? axes.get("L");
  const height = axes.get("H");

  if (!plausible(width) || !plausible(depth)) return null;

  return {
    width,
    depth,
    ...(plausible(height) && { height }),
  };
}

/**
 * The common ruler every footprint is drawn against.
 *
 * Each plan is scaled to this rather than to its own card, so a 28" chair and
 * a 118" sectional look as different on the page as they are in a room. Scale
 * each to fit its own box and the drawing becomes decoration — every piece the
 * same size, which is the one thing a plan must never say.
 */
export const REFERENCE_WIDTH_INCHES = 120;

/** Width of a footprint as a percentage of the reference ruler. */
export function footprintScale(widthInches: number) {
  return `${Math.min(100, (widthInches / REFERENCE_WIDTH_INCHES) * 100)}%`;
}
