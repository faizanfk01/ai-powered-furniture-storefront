"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Measure } from "@/components/ui/measure";
import { LOCATIONS, NAV_LINKS, whatsappUrl } from "@/lib/site";

import { WhatsAppIcon } from "./whatsapp-icon";

/**
 * The small-screen navigation.
 *
 * A client component, and the only one in the site chrome — the header and
 * footer around it stay server-rendered. The interactive surface is this
 * panel and nothing else.
 *
 * Opens to a full ink panel rather than a dropdown: on a phone this is the
 * whole screen anyway, and the ink ground makes it unmistakably a different
 * mode rather than a list floating over the page.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="spec-label -mr-2 inline-flex items-center gap-2 px-2 py-3 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
      >
        {open ? "Close" : "Menu"}
        <span aria-hidden="true" className="flex flex-col gap-[3px]">
          <span
            className={`block h-px w-4 bg-current transition-transform ${
              open ? "translate-y-[4px] rotate-45" : ""
            }`}
          />
          <span className={`block h-px w-4 bg-current ${open ? "opacity-0" : ""}`} />
          <span
            className={`block h-px w-4 bg-current transition-transform ${
              open ? "-translate-y-[4px] -rotate-45" : ""
            }`}
          />
        </span>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="fixed inset-x-0 top-[var(--header-height)] bottom-0 z-50 overflow-y-auto bg-ink-deep text-paper"
        >
          <div className="px-6 py-10 sm:px-10">
            <Measure />

            <nav aria-label="Main" className="mt-8">
              <ul className="flex flex-col gap-1">
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
                        className={`display-wide block py-3 text-2xl font-medium uppercase transition-colors ${
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

            <div className="mt-10">
              <Button
                variant="outline-invert"
                href={whatsappUrl(
                  "Hello Standard Furniture — I have a question.",
                )}
                className="w-full"
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </Button>
            </div>

            <dl className="mt-12 grid grid-cols-1 gap-8 border-t border-paper/15 pt-8 sm:grid-cols-2">
              {LOCATIONS.map((location) => (
                <div key={location.label}>
                  <dt className="spec-label text-brass">{location.label}</dt>
                  <dd className="mt-2 text-paper/80">
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
