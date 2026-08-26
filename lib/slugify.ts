/**
 * Turn a product name into a URL slug.
 *
 *   "Karachi 3-Seater Sofa"            -> karachi-3-seater-sofa
 *   "Gulbahar Study Desk & Chair Set"  -> gulbahar-study-desk-and-chair-set
 *   'Bench 48" wide'                   -> bench-48-wide
 *
 * The output must satisfy slugSchema in lib/validations/common.ts —
 * `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 96 characters or fewer. That schema
 * deliberately does NOT lowercase or repair what it is given, so the repairing
 * happens here, before the value is ever shown to the person who can override
 * it. What they see in the field is exactly what will be submitted.
 *
 * `&` becomes "and" rather than being dropped, matching the seeded catalogue
 * ("gulbahar-study-desk-and-chair-set"). Dropping it would silently glue two
 * words together.
 */
export function slugify(name: string) {
  const slug = name
    .normalize("NFKD")
    // Strip diacritics rather than transliterating them: the catalogue is
    // English, and a stray accent should not become a hyphen.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    // Everything that is not a letter or digit becomes a separator — inch
    // marks, apostrophes, slashes, em dashes.
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= 96) return slug;

  // Truncating mid-word is fine; truncating onto a trailing hyphen is not,
  // because that fails the schema's "no trailing hyphen" rule.
  return slug.slice(0, 96).replace(/-+$/, "");
}
