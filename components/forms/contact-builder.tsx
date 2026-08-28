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
            placeholder="Ayesha Khan"
            className={storefrontControlClass}
          />
        </Field>

        <Field id="contact-message" label="Your message">
          <textarea
            id="contact-message"
            rows={6}
            value={draft.message}
            onChange={(event) => update("message", event.target.value)}
            placeholder="Do you deliver to Charsadda, and is there a charge for it?"
            className={`${storefrontControlClass} resize-y`}
          />
        </Field>
      </div>

      <div className="lg:sticky lg:top-28 lg:self-start">
        <WhatsAppHandoff
          message={buildContactMessage(draft)}
          ready={contactIsReady(draft)}
          emptyHint="Write your message and it will appear here, ready to send."
        />
      </div>
    </div>
  );
}
