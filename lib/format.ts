import type { StockStatus } from "./generated/prisma/enums";

/**
 * Prices, as a customer in Mardan reads them.
 *
 * `en-PK` renders PKR as "Rs 118,000" rather than the "PKR 118,000" that
 * `en-US` produces. Rs is what is written on a price tag here; PKR is what a
 * bank writes. The column is whole rupees (no paisa — see schema.prisma), so
 * fraction digits are off rather than rounded away.
 *
 * Built once at module scope: constructing an Intl formatter is the expensive
 * part, and the catalogue calls this once per card.
 */
const priceFormatter = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

export function formatPrice(rupees: number) {
  return priceFormatter.format(rupees);
}

/**
 * Stock status in the shop's own words.
 *
 * "Made to order" is not a lesser version of "In stock" — for a business whose
 * first offering is custom furniture it is the more interesting answer, and it
 * is styled as such (brass) rather than greyed out like an apology.
 */
export const STOCK_LABEL: Record<StockStatus, string> = {
  IN_STOCK: "In stock",
  OUT_OF_STOCK: "Out of stock",
  MADE_TO_ORDER: "Made to order",
};
