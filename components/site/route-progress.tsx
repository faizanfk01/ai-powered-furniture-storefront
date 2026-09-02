"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The thin brass bar across the top of the window during a route change.
 *
 * WHY THIS EXISTS. Every storefront route here is static and prefetched, so a
 * click lands the new page in tens of milliseconds. That is fast enough to
 * read as nothing happening at all — the page contents swap with no event to
 * connect them to the click, which is what makes the site feel abrupt rather
 * than quick. The bar is the receipt for the click.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT `useLinkStatus`, WHICH IS THE API BUILT FOR THIS
 * ---------------------------------------------------------------------------
 * Two disqualifications, both from its own reference page
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-link-status.md):
 *
 *   1. "must be used within a descendant component of a Link component" — it
 *      reports on ONE link, so a global bar would mean rendering a hook inside
 *      every <Link> on the site and lifting the state back out.
 *   2. "If the linked route has been prefetched, the pending state will be
 *      skipped." Every route here is prefetched. The hook would report nothing
 *      on precisely the navigations this bar exists for.
 *
 * `onNavigate` on <Link> is the right *signal* — client-side, same-origin
 * navigations only — but it is a per-link prop, and threading it through every
 * link in the header, the footer, the product cards, the chat replies and the
 * admin nav is a lot of edits to files this change has no business touching.
 * The capture-phase listener below reads the same event one level up.
 *
 * Vercel's react-transition-progress (which the linking-and-navigating guide
 * points at) is an example repo, not a package, and it works by wrapping every
 * navigation in its own startTransition — the same reach into call sites, plus
 * a dependency. CLAUDE.md locks the stack; a progress bar is not the reason to
 * unlock it. This file is the whole feature and it imports nothing.
 *
 * ---------------------------------------------------------------------------
 * THE TWO SIGNALS
 * ---------------------------------------------------------------------------
 * START is a capture-phase click on an anchor that will actually navigate this
 * app: same origin, plain left click, no modifier, no target, no download, and
 * a DIFFERENT pathname from the one we are on. Plus popstate, so the browser's
 * own back and forward buttons get the same feedback.
 *
 * FINISH is `usePathname()` changing. In the App Router the URL updates when
 * React commits the new route, so that is exactly "the new page is ready" —
 * not a guess at how long it might take.
 *
 * NEITHER SIGNAL SEES THE CATALOGUE FILTERS, and that is deliberate rather
 * than a gap. components/catalog/catalog-filters.tsx navigates with
 * router.replace() on a debounced keystroke — no anchor is clicked, and only
 * the query string changes — so a search-as-you-type does not strobe the bar
 * once per letter. The pathname test below is what enforces that: a link whose
 * pathname matches the current one is ignored, whatever its query.
 *
 * It also means this file never calls useSearchParams(), which would drag the
 * root layout — and with it /about, /contact and /custom-orders, the pages
 * that genuinely prerender today — out of static rendering for a decoration.
 */

/**
 * FOUR PHASES, and `arming` is the load-bearing one.
 *
 * A CSS transition needs a previous value to move from. Rendering the bar
 * straight into its running state gives it none — React commits one style and
 * the browser has nothing to interpolate, so the bar simply appears at 85%.
 * `arming` paints one frame at scaleX(0) with transitions off; `running` is
 * set two frames later, and that frame boundary is the transition's start.
 */
type Phase = "idle" | "arming" | "running" | "finishing";

/**
 * The bar is visible for at least this long, however fast the route resolved.
 *
 * This is the whole feature on a prefetched site. A pathname that changes 30ms
 * after the click would otherwise flash the bar for two frames, which reads as
 * a glitch — the opposite of the reassurance being asked for. The Next docs
 * suggest the mirror-image trick for a different problem (delay the indicator
 * so fast navigations never show one); here the navigations are ALWAYS fast
 * and the indicator is the point, so the floor is on the visible duration
 * instead.
 */
const MIN_VISIBLE_MS = 280;

/** Must match the finishing transitions in app/globals.css: 170ms + 200ms. */
const FINISH_MS = 380;

/**
 * Nothing should reach this. It exists so a navigation that never commits —
 * an aborted route, a thrown error boundary — cannot leave a brass bar parked
 * across the top of the window for the rest of the session.
 */
const SAFETY_MS = 8_000;

export function RouteProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");

  /**
   * The phase, readable from the event listeners.
   *
   * They are registered once and would otherwise close over the phase as it
   * was at mount — permanently "idle", so every click would look like a fresh
   * start even mid-navigation.
   */
  const phaseRef = useRef<Phase>("idle");

  /** The last pathname React has actually committed. */
  const settledPath = useRef(pathname);

  const startedAt = useRef(0);
  const timers = useRef<number[]>([]);

  const enter = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  const finish = useCallback(() => {
    if (phaseRef.current === "idle" || phaseRef.current === "finishing") return;

    clearTimers();

    // Hold the bar until it has been on screen long enough to have been seen.
    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt.current));

    timers.current.push(
      window.setTimeout(() => {
        enter("finishing");
        timers.current.push(window.setTimeout(() => enter("idle"), FINISH_MS));
      }, remaining),
    );
  }, [clearTimers, enter]);

  const start = useCallback(() => {
    // A click landing while the previous bar is still fading out restarts it.
    // `arming` resets to scaleX(0) with transitions off, so the restart is a
    // cut rather than a visible rewind from full width back to nothing.
    if (phaseRef.current === "arming" || phaseRef.current === "running") return;

    clearTimers();
    startedAt.current = Date.now();
    enter("arming");
    timers.current.push(window.setTimeout(finish, SAFETY_MS));
  }, [clearTimers, enter, finish]);

  // arming → running, two frames later. One rAF is usually enough; two is the
  // idiom that holds when the first fires inside the same frame as the commit.
  useEffect(() => {
    if (phase !== "arming") return;

    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => enter("running"));
    });

    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [phase, enter]);

  // FINISH. Skipped on mount, where settledPath already holds this pathname.
  useEffect(() => {
    if (pathname === settledPath.current) return;
    settledPath.current = pathname;
    finish();
  }, [pathname, finish]);

  // START.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Capture phase, so this runs before anything downstream can stop the
      // event — but a handler that already ran and cancelled it (a disabled
      // control, a menu that swallows its own clicks) means no navigation.
      if (event.defaultPrevented) return;
      // Left button only, and no modifier: ctrl/cmd/shift-click opens a tab or
      // a window and leaves this document exactly where it is.
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      // `_blank` on the WhatsApp and social links; `download` on nothing today,
      // but both leave this page in place.
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        // The resolved absolute form, so a relative href is compared correctly
        // and a mailto:/tel:/javascript: href fails the origin test below
        // rather than being parsed as a path.
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // wa.me, Google Maps, the social profiles — a full page unload, and the
      // browser draws its own loading UI for that.
      if (url.origin !== window.location.origin) return;

      // Same page. Covers a #anchor, a re-click on the current nav item, and
      // every query-only navigation — see the note at the top of this file.
      if (url.pathname === settledPath.current) return;

      start();
    }

    function onPopState() {
      // Back and forward within one page — a filtered catalogue URL, a hash —
      // change no pathname and get no bar, for the same reason a click on one
      // does not.
      if (window.location.pathname === settledPath.current) return;
      start();
    }

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  // Timers outlive the component otherwise — a phase change scheduled into an
  // unmounted tree is a React warning and a leak.
  useEffect(() => clearTimers, [clearTimers]);

  return (
    // Decorative, and deliberately not a role="progressbar": it reports no
    // real value, and announcing a nameless progress indicator on every link
    // click is noise in a screen reader. The route change itself is what gets
    // announced, by the browser.
    <div className="route-progress" data-phase={phase} aria-hidden="true" />
  );
}
