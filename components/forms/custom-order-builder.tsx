"use client";

import { useState } from "react";

import { Field, storefrontControlClass } from "@/components/ui/field";
import {
  buildCustomOrderMessage,
  customOrderIsReady,
  type CustomOrderDraft,
} from "@/lib/messages";
import { OFFERINGS } from "@/lib/site";

import { WhatsAppHandoff } from "./whatsapp-handoff";

/**
 * The custom-order message builder.
 *
 * THIS FORM DOES NOT SEND ANYTHING. It composes a message and hands it to
 * WhatsApp, where the customer still has to press send. Everything about the
 * interface is arranged so that is obvious before the tap rather than
 * surprising after it:
 *
 *   - The draft is shown in full, live, in the spec face. You can read the
 *     exact words that will appear in your chat.
 *   - The button says what it does — opens WhatsApp — and not "Submit".
 *   - There is no success state, because success is not ours to report. The
 *     moment the chat opens, this page has finished its job and the
 *     conversation belongs to WhatsApp.
 *
 * A "message sent!" confirmation here would be a straightforward lie: nothing
 * has been sent, and the customer who closes WhatsApp without pressing send
 * would be told the shop has their enquiry when it does not.
 */
export function CustomOrderBuilder() {
  const [draft, setDraft] = useState<CustomOrderDraft>({
    service: "",
    description: "",
    dimensions: "",
  });

  function update(field: keyof CustomOrderDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  const message = buildCustomOrderMessage(draft);
  const ready = customOrderIsReady(draft);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      {/* No onSubmit, no action: there is nothing to submit. The fields feed
          the draft, and the link below is the only way out of here. */}
      <div className="flex flex-col gap-6">
        <Field
          id="service"
          label="What do you need?"
          hint="Pick the closest — you can explain properly below."
        >
          <select
            id="service"
            value={draft.service}
            onChange={(event) => update("service", event.target.value)}
            className={storefrontControlClass}
          >
            <option value="">Choose a service</option>
            {OFFERINGS.map((offering) => (
              <option key={offering.title} value={offering.title}>
                {offering.title}
              </option>
            ))}
            <option value="Something else">Something else</option>
          </select>
        </Field>

        <Field
          id="description"
          label="Tell us about it"
          optional
          hint="The room, what it is for, what you have in mind."
        >
          <textarea
            id="description"
            rows={5}
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="A wardrobe for a bedroom with a sloped ceiling, in a dark wood to match an existing bed."
            className={`${storefrontControlClass} resize-y`}
          />
        </Field>

        <Field
          id="dimensions"
          label="Rough dimensions"
          optional
          hint="Whatever you know. We measure properly before anything is cut."
        >
          <input
            id="dimensions"
            type="text"
            value={draft.dimensions}
            onChange={(event) => update("dimensions", event.target.value)}
            // The site's own notation, so the shop reads it the way it reads
            // every dimension in the catalogue.
            placeholder={'84" W x 36" D x 30" H'}
            className={storefrontControlClass}
          />
        </Field>
      </div>

      {/* The draft, exactly as it will arrive.

          Plain flow — no sticky. This column used to be `lg:sticky lg:top-28`,
          which pinned the preview 112px from the top of the viewport and let
          the form scroll past underneath it. The intent was to keep the draft
          in sight while you typed; the effect was a panel that detached from
          its own section and floated over the page, which reads as a bug
          rather than a convenience.

          `lg:pr-4` keeps the panel off the container's right edge, so it sits
          as a panel on the page rather than as something aligned flush to the
          page boundary. Same change as components/forms/contact-builder.tsx —
          the two builders had the same stray sticky. */}
      <div className="lg:pr-4">
        <WhatsAppHandoff
          message={message}
          ready={ready}
          emptyHint="Choose a service or write a line about what you need, and your message will appear here."
        />
      </div>
    </div>
  );
}
