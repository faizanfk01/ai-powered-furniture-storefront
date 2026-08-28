"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useChat } from "@/components/chat/chat-context";
import { ChatGlyph } from "@/components/chat/chat-glyph";
import { Button } from "@/components/ui/button";
import { LOCATIONS, NAV_LINKS, whatsappUrl } from "@/lib/site";

import { WhatsAppIcon } from "./whatsapp-icon";

/**
 * The small-screen navigation.
 *
 * A client component, and the only stateful one in the site chrome — the
 * header and footer around it stay server-rendered.
 *
 * Opens to a full ink panel below the bar. That was true before and stays
 * true, but it means something different now: the header is dark too, so the
 * panel reads as the bar unfolding rather than as a separate mode dropped over
 * the page.
 *
 * Restyled only. The open/close state, the close-on-navigation pass, the
 * Escape handler and the scroll lock are exactly as they were.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The global drawer's own open state — the same one the floating launcher
  // and the header button use. Nothing new is wired; the panel just needs a
  // way to hand off to it.
  const { setOpen: setChatOpen } = useChat();

  // Close on navigation. Without this the panel stays open over the page the
  // visitor just asked for, which reads as a broken link.
  //
  // Adjusted during render rather than in an effect: an effect would paint the
  // stale open panel first and close it on the next pass, and React flags the
  // cascading render. Comparing against the previous pathname is the
  // documented way to derive state from a changed prop — and unlike an
  // onClick on each link, it also covers the browser's back button.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (renderedPathname !== pathname) {
    setRenderedPathname(pathname);
    setOpen(false);
  }

  // Escape closes, and the page behind does not scroll while it is open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      {/* Icon only now. The word "Menu" beside three rules was part of the
          labelled-diagram language of the old identity; a hamburger needs no
          caption, and the accessible name is carried by the sr-only span
          rather than by visible text. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="-mr-2 inline-flex size-10 items-center justify-center rounded-lg text-paper transition-colors hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <span aria-hidden="true" className="flex flex-col gap-[5px]">
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition-transform ${
              open ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition-opacity ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-5 rounded-full bg-current transition-transform ${
              open ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="fixed inset-x-0 top-[var(--header-height)] bottom-0 z-50 overflow-y-auto bg-ink text-paper"
        >
          <div className="px-4 py-6 sm:px-6">
            <nav aria-label="Main">
              {/* Divided rows rather than a stack of tracked-out capitals:
                  a phone nav is a list, and a list is what people expect to
                  tap down. */}
              <ul className="flex flex-col divide-y divide-paper/10 border-y border-paper/10">
                {NAV_LINKS.map((link) => {
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(link.href);

                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        className={`block py-4 text-lg font-medium transition-colors ${
                          active ? "text-brass" : "text-paper hover:text-brass"
                        }`}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="mt-6 flex flex-col gap-3">
              {/* Closes the panel before opening the drawer, so the drawer is
                  not stacked over a nav the visitor has finished with. Same
                  `setOpen` from ChatProvider the launcher already calls. */}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setChatOpen(true);
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-paper/25 px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:border-paper/50 hover:bg-paper/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
              >
                <ChatGlyph className="size-4" />
                Ask AI
              </button>

              <Button
                variant="solid-invert"
                href={whatsappUrl(
                  "Hello Standard Furniture, I have a question.",
                )}
                className="w-full"
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>
            </div>

            <dl className="mt-8 grid grid-cols-1 gap-6 border-t border-paper/10 pt-6 sm:grid-cols-2">
              {LOCATIONS.map((location) => (
                <div key={location.label}>
                  <dt className="text-sm font-semibold text-paper">
                    {location.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-paper/65">
                    {location.lines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
