import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

/**
 * The document shell, and nothing else.
 *
 * Everything visible now lives in a route group's own layout:
 *
 *   app/(storefront)/layout.tsx — the public site's header and footer
 *   app/(admin)/layout.tsx      — the admin tool's frame
 *
 * The two are deliberately unalike. The storefront is a showroom; the admin is
 * a dense tool for entering data. They share this file so they share the
 * fonts, the design tokens and the brand palette — and share nothing else.
 *
 * Route groups do not appear in the URL: `app/(storefront)/catalog/page.tsx`
 * is still `/catalog`.
 */

/**
 * One typeface.
 *
 * The three-voice system this replaces — Archivo on its width axis for
 * signage, Newsreader for catalogue prose, IBM Plex Mono for specs — was built
 * for a showroom identity. The brief for this pass is a clean modern
 * storefront, and that look is carried by spacing, weight and hierarchy rather
 * than by a change of face partway down the page.
 *
 * Inter is the whole system now. Its variable weight axis is what the old
 * three faces were doing: 600 for a heading, 500 for a price, 400 for prose,
 * and a small tracked uppercase for a label. Prices and dimensions that used
 * to be set in mono are Inter too — a tabular figure in a heavier weight reads
 * as a number without borrowing a code editor's voice.
 *
 * `--font-inter` is consumed by all three font tokens in globals.css, so
 * `font-display`, `font-body` and `font-mono` keep working and all resolve to
 * the same family. That is deliberate: it lets the pages convert in later
 * sub-steps instead of all at once.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  // Explicit so `font-feature-settings` below has something to switch on.
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Standard Furniture, Mardan",
    template: "%s · Standard Furniture",
  },
  description:
    "Custom furniture, interior design, 3D wallpapers and PVC panels. Showroom at Shen Gul Plaza, Mardan; workshop at Sir Anjam Khan Market, Baghdada.",
};

/**
 * Next already emits `width=device-width, initial-scale=1`. This adds the one
 * part it does not.
 *
 * `interactiveWidget: "resizes-content"` tells the browser that opening the
 * on-screen keyboard should shrink the viewport rather than slide the page up
 * behind it. It matters for the chat panel, which is `position: fixed` and
 * puts its text input at the very bottom: under the default behaviour the
 * keyboard covers the composer on a phone, which is the one device most of
 * this site's customers are on. It also helps the two WhatsApp form pages,
 * whose submit sits below a textarea.
 *
 * Ignored by browsers that do not implement it, and harmless there.
 */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
