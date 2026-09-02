"use client";

import { useState } from "react";

import { Field, storefrontControlClass } from "@/components/ui/field";
import {
  buildContactMessage,
  contactIsReady,
  type ContactDraft,
} from "@/lib/messages";

import { WhatsAppHandoff } from "./whatsapp-handoff";

/**
 * The contact message builder — the smaller sibling of the custom-order one.
 *
 * Two fields, because a general enquiry needs two things: who is asking and
 * what they want. Anything else (a phone number, an email address) would be a
 * field asking for information WhatsApp already carries, on a form that cannot
 * store it.
 *
 * Same rules as the other builder: nothing is submitted, the draft is visible
 * before the tap, and there is no success state. See WhatsAppHandoff.
 */
export function ContactBuilder() {
  const [draft, setDraft] = useState<ContactDraft>({ name: "", message: "" });

  function update(field: keyof ContactDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="flex flex-col gap-6">
        <Field
          id="contact-name"
          label="Your name"
          optional
          hint="So we know who we are replying to."
        >
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            value={draft.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Type your name here"
            className={storefrontControlClass}
          />
        </Field>

        <Field id="contact-message" label="Your message">
          <textarea
            id="contact-message"
            rows={6}
            value={draft.message}
            onChange={(event) => update("message", event.target.value)}
            placeholder="Type your message here"
            className={`${storefrontControlClass} resize-y`}
          />
        </Field>
      </div>

      {/* Plain flow — no sticky.
          This column used to be `lg:sticky lg:top-28`, which pinned the
          preview 112px from the top of the viewport and let the form scroll
          past underneath it. The intent was to keep the draft in sight while
          you typed; the effect was a panel that detached from its own section
          and floated over the page, which reads as a bug rather than a
          convenience. The section is short enough that both columns fit
          without it.

          `lg:pr-4` keeps the panel off the container's right edge, so it sits
          as a panel on the page rather than as something aligned flush to the
          page boundary. */}
      <div className="lg:pr-4">
        <WhatsAppHandoff
          message={buildContactMessage(draft)}
          ready={contactIsReady(draft)}
          emptyHint="Write your message and it will appear here, ready to send."
        />
      </div>
    </div>
  );
}
