/**
 * The business, as data.
 *
 * Addresses, the WhatsApp number and the nav live here rather than inline in
 * the header and footer because most of them appear in more than one place —
 * the phone number is in the footer, in every product CTA, and on the contact
 * page — and a phone number that is right in two places out of three is worse
 * than one that is wrong everywhere, because nobody notices.
 */

export const SITE = {
  name: "Standard Furniture",
  town: "Mardan",
  region: "Khyber Pakhtunkhwa",
  tagline:
    "Custom furniture, interior design, 3D wallpapers and PVC panels.",
} as const;

/**
 * Two addresses doing two different jobs. Kept as a list rather than as
 * `address` and `address2` so neither can quietly become the primary one.
 */
export const LOCATIONS = [
  {
    label: "Showroom",
    role: "Come and see the work",
    lines: ["Shen Gul Plaza", "Mardan"],
  },
  {
    label: "Workshop",
    role: "Where the pieces are made",
    lines: ["Sir Anjam Khan Market", "Baghdada, Mardan"],
  },
] as const;

/**
 * The four things the business sells.
 *
 * Here rather than in a page file because the home page and the About page
 * both list them, and a fifth offering added to one and not the other is the
 * kind of drift nobody notices until a customer asks about something the site
 * only half-mentions.
 */
export const OFFERINGS = [
  {
    title: "Custom furniture",
    body: "Sofas, beds, dining and office pieces built to your room's measurements in our own workshop — not ordered in from somewhere else.",
  },
  {
    title: "Interior design",
    body: "Room-by-room planning: layout, materials and finishes chosen against the space you actually have, not a catalogue photograph.",
  },
  {
    title: "3D wallpapers",
    body: "Textured wall panels and printed murals, fitted by the same team that delivers the furniture.",
  },
  {
    title: "PVC panels",
    body: "Hard-wearing wall and ceiling panelling for rooms that take daily use — kitchens, corridors, shopfronts.",
  },
] as const;

/**
 * PLACEHOLDER — NOT CONFIRMED WITH THE BUSINESS.
 *
 * Opening hours are a factual claim a customer will act on: someone reads
 * this, drives to Shen Gul Plaza, and finds the shutter down. Nothing here was
 * supplied in the brief, so these are a structural stand-in to be replaced
 * with real hours before this site is public — not a guess to be left alone
 * because it looks finished.
 */
export const HOURS = {
  confirmed: false,
  lines: ["Monday – Saturday", "10:00 – 20:00", "Friday break 12:30 – 14:30"],
} as const;

// ---------------------------------------------------------------------------
// WhatsApp — the only conversion path (see CLAUDE.md → Payments)
// ---------------------------------------------------------------------------

/** International format, digits only — what wa.me expects in the path. */
export const WHATSAPP_NUMBER = "923009059052";

/** Human-readable, for display. */
export const WHATSAPP_DISPLAY = "+92 300 905 9052";

/**
 * A wa.me link, optionally pre-filled.
 *
 * The prefill is the useful part: someone tapping through from a product page
 * should not have to type "hi, about the sofa" before the conversation can
 * start. Passing the product name here means the shop sees which piece the
 * message is about in the first line.
 */
export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Label and href differ for the catalogue on purpose: the copy uses British
 * spelling, which is what Pakistani English reads as correct, while the URL
 * stays at the shorter /catalog.
 *
 * NOTE: "/custom-orders" and "/contact" do not exist yet — both are forms, and
 * forms are Phase 4c. They 404 until then.
 */
export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Catalogue", href: "/catalog" },
  { label: "Custom Orders", href: "/custom-orders" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
] as const;
