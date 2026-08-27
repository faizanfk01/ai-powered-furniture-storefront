import { ChatProvider } from "@/components/chat/chat-context";
import { ChatWidget } from "@/components/chat/chat-widget";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/**
 * The public site's frame: header, footer, skip link.
 *
 * Lifted out of the root layout when the admin arrived, so the two surfaces
 * can look nothing like each other. Nothing about this file changed except
 * where it lives — the storefront renders exactly as before.
 */
export default function StorefrontLayout({
  children,
}: LayoutProps<"/">) {
  return (
    // ChatProvider is a Client Component, but `children` is passed to it as a
    // prop — so every page inside stays server-rendered exactly as before.
    // It wraps the whole storefront rather than sitting beside the widget
    // because the product page's "Ask AI about this piece" button is inside
    // `children` and has to reach the panel from there.
    <ChatProvider>
      <div className="flex min-h-full flex-col">
        {/* Keyboard and screen-reader users get past the nav on every page.
            Hidden until focused, then it sits over the sticky header. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-paper focus:outline-2 focus:outline-offset-2 focus:outline-brass"
        >
          Skip to content
        </a>

        <SiteHeader />

        <main id="main" className="flex-1">
          {children}
        </main>

        <SiteFooter />

        {/* Sitewide, and only here — the admin layout is a separate file, so the
            widget cannot follow an admin into the dashboard. Mounted in the
            layout rather than per page so the transcript survives navigation:
            a layout does not remount when the page inside it changes, which is
            what lets somebody open a recommended product and come back to the
            conversation that recommended it. */}
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}
