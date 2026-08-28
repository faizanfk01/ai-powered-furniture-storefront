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

export type Location = (typeof LOCATIONS)[number];

/**
 * A Google Maps search for one of our addresses.
 *
 * A search URL rather than an embedded map or a pinned coordinate, because
 * there is no verified business listing yet — an embed would either show the
 * wrong pin with total confidence or an apologetic grey box, and both are
 * worse than handing the address to Maps and letting it do what it does with
 * any address someone types.
 *
 * "Pakistan" is appended because "Mardan" alone is ambiguous enough
 * internationally to send somebody to the wrong country.
 */
export function directionsUrl(location: { lines: readonly string[] }) {
  const query = [...location.lines, "Pakistan"].join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

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
    body: "Sofas, beds, dining and office pieces, built to the size of your room in our own workshop. We do not order them in from anywhere else.",
  },
  {
    title: "Interior design",
    body: "We plan a room at a time. Layout, materials and finishes picked for the space you actually have, not for a photo in a catalogue.",
  },
  {
    title: "3D wallpapers",
    body: "Textured wall panels and printed murals, put up by the same team that brings your furniture.",
  },
  {
    title: "PVC panels",
    body: "Tough wall and ceiling panelling for rooms that get used every day. Kitchens, corridors, shopfronts.",
  },
] as const;

/**
 * CONFIRMED WITH THE BUSINESS.
 *
 * These were a placeholder until now, and the whole site was built around not
 * trusting them: opening hours are a factual claim a customer acts on by
 * driving to Shen Gul Plaza, so while `confirmed` was false the contact page
 * showed a caution beside them, the footer said "To be confirmed", and
 * lib/ai/facts.ts refused to tell the assistant what they were.
 *
 * The flag is what turned all of that off. Nothing else needed editing: every
 * one of those three places already asked this question rather than hardcoding
 * an answer, which is the reason the flag existed.
 *
 * EACH LINE CARRIES ITS OWN DAYS AND ITS OWN TIMES, and they run in week
 * order, Monday to Sunday. The version this replaces was three rows —
 * "Saturday – Thursday", "10:00 – 20:00", "Friday closed" — that only meant
 * anything if you read all three and joined them yourself, and the middle row
 * was a bare time attached to nothing. A row that answers "when are you open"
 * on its own is worth the repetition of printing the same hours twice.
 *
 * Friday sits in its natural place in the week rather than being appended as
 * an exception, which is also why the open days are two ranges instead of one:
 * a single "Monday – Sunday" line with a Friday caveat under it contradicts
 * itself for as long as it takes to read the second line.
 *
 * TWELVE-HOUR TIMES. Every other number on this site is set in the shop's own
 * terms — Rs on a price tag, inches on a dimension — and a customer in Mardan
 * reads 7 PM, not 19:00.
 */
export const HOURS = {
  confirmed: true,
  lines: [
    "Monday – Thursday: 10:00 AM – 7:00 PM",
    "Friday: Closed",
    "Saturday – Sunday: 10:00 AM – 7:00 PM",
  ],
} as const;

// ---------------------------------------------------------------------------
// WhatsApp — the only conversion path (see CLAUDE.md → Payments)
// ---------------------------------------------------------------------------

/**
 * International format, digits only — what wa.me expects in the path.
 *
 * THIS IS THE NUMBER. Every link that dials or opens a chat is built from this
 * constant, never from the formatted string below, so how the number is
 * grouped for reading cannot change where a tap goes.
 */
export const WHATSAPP_NUMBER = "923009059052";

/**
 * Human-readable, for display. Same digits, grouped the way the shop writes
 * them: `+92 300 9059052`.
 *
 * DISPLAY ONLY. The contact page's tel: link strips every non-digit out of
 * this before using it, so it resolves to WHATSAPP_NUMBER whatever the spacing
 * is, and wa.me links never touch it at all.
 */
export const WHATSAPP_DISPLAY = "+92 300 9059052";

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
// Social
// ---------------------------------------------------------------------------

/**
 * Where the shop already is, off this site.
 *
 * Here rather than inline in the footer for the same reason the phone number
 * is: an account that gets renamed has one place to be corrected. `label` is
 * the accessible name — the links render as icons, and an icon with no name is
 * a link a screen reader announces as nothing at all.
 *
 * These are the URLs the business supplied, verbatim, tracking parameters
 * included. Trimming what looks like noise off someone else's share link is
 * how a working link becomes a 404.
 */
export const SOCIAL_LINKS = [
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@standardfurnitures49?_r=1&_t=ZS-99BW3KfWvDk",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/1Zfx85eiHF/",
  },
] as const;

export type SocialLink = (typeof SOCIAL_LINKS)[number];

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
