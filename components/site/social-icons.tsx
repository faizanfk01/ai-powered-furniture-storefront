/**
 * TikTok and Facebook glyphs.
 *
 * MONOCHROME, unlike components/site/whatsapp-icon.tsx.
 *
 * That is a deliberate difference rather than an oversight. The WhatsApp glyph
 * keeps its brand green because it is the site's one conversion path and the
 * colour is what makes people tap it. These two are not a conversion path; they
 * are a footer courtesy. Rendering them in TikTok's cyan-and-magenta and
 * Facebook's blue would put three competing brand colours along the bottom of
 * a page whose own palette is petrol and brass, and the loudest thing in the
 * footer would be somebody else's logo.
 *
 * So they inherit `currentColor` and take the paper tint the footer links
 * already use. Both marks stay perfectly recognisable in one colour, which is
 * what a logo is designed for.
 *
 * `aria-hidden` on both: the accessible name comes from the link that wraps
 * them, from SOCIAL_LINKS[].label. An icon that announces itself AND sits in a
 * named link is read twice.
 */

export function TikTokIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.03-2.82h-3.4v13.67a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.2-2.51v-3.45a6.03 6.03 0 0 0-6.62 6.01A6.03 6.03 0 0 0 9.6 22.6a6.03 6.03 0 0 0 6.03-6.03V9.4a7.68 7.68 0 0 0 4.48 1.43V7.44a4.3 4.3 0 0 1-3.5-1.62Z" />
    </svg>
  );
}

export function FacebookIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z" />
    </svg>
  );
}

/** Keyed by the label in SOCIAL_LINKS, so the footer maps rather than branches. */
export const SOCIAL_ICONS: Record<
  string,
  (props: { className?: string }) => React.ReactElement
> = {
  TikTok: TikTokIcon,
  Facebook: FacebookIcon,
};
