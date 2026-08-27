import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";

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
 * Three faces, three jobs. See the note in globals.css for why they are this
 * unlike each other.
 *
 * Archivo is loaded with its width axis: the wordmark and headings are set
 * expanded, which is what gives the type its showroom-signage feel. Without
 * `axes: ["wdth"]` next/font ships weight only and the width setting silently
 * does nothing.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Standard Furniture — Mardan",
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
      className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
