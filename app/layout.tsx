import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

import "./globals.css";

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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Keyboard and screen-reader users get past the nav on every page.
            Hidden until focused, then it sits over the sticky header. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:font-display focus:text-sm focus:tracking-wide focus:text-paper focus:uppercase"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
