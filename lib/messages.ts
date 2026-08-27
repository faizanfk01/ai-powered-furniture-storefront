/**
 * Composing the WhatsApp messages the forms hand off.
 *
 * Pure functions, no React, no DOM — so the same text feeds the on-screen
 * preview and the wa.me link. If the preview were built separately from the
 * link, the two would eventually disagree, and the one thing this page
 * promises is that what you see is what gets pasted into your chat.
 *
 * These build the message body only. Turning it into a URL is whatsappUrl()'s
 * job in lib/site.ts, which is the single place that knows the number.
 */

/** Collapses stray whitespace and trims — pasted text arrives ragged. */
function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Joins sentence fragments, dropping the empty ones.
 *
 * The optional fields are genuinely optional: somebody who picks "3D
 * wallpapers" and types nothing else still sends a message that reads
 * properly, rather than one with a dangling "Rough dimensions:" and a blank.
 */
function sentences(parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export type CustomOrderDraft = {
  service: string;
  description: string;
  dimensions: string;
};

/**
 * A service title dropped into the middle of a sentence.
 *
 * "Custom furniture" wants to become "custom furniture", but a blanket
 * toLowerCase() turns "3D wallpapers" into "3d wallpapers" and "PVC panels"
 * into "pvc panels" — the shop's own product names, misspelled in a message
 * written on the shop's behalf.
 *
 * So only a plainly capitalised word is lowered: leading capital, rest
 * lowercase. "3D" and "PVC" match neither and are left exactly as typed.
 */
function midSentence(title: string) {
  const [first, ...rest] = title.split(" ");
  if (!first) return title;

  const lead = /^[A-Z][a-z]+$/.test(first) ? first.toLowerCase() : first;
  return [lead, ...rest].join(" ");
}

/**
 * "Hello, I'd like to enquire about custom furniture. …"
 *
 * British spelling, matching the rest of the site — the nav says Catalogue and
 * the product page says Enquire on WhatsApp.
 */
export function buildCustomOrderMessage(draft: CustomOrderDraft) {
  const service = tidy(draft.service);
  const description = tidy(draft.description);
  const dimensions = tidy(draft.dimensions);

  return sentences([
    service
      ? `Hello, I'd like to enquire about ${midSentence(service)}.`
      : "Hello, I'd like to enquire about a custom piece.",
    description,
    dimensions && `Rough dimensions: ${dimensions}.`,
  ]);
}

/**
 * Is there enough here to be worth opening a chat?
 *
 * Deliberately forgiving: a chosen service alone is a real message. What this
 * blocks is the empty one — handing somebody a WhatsApp draft that says
 * nothing wastes their tap and the shop's attention.
 */
export function customOrderIsReady(draft: CustomOrderDraft) {
  return Boolean(tidy(draft.service) || tidy(draft.description));
}

export type ContactDraft = {
  name: string;
  message: string;
};

/** "Hello, this is Ayesha. …" — the name is what the shop answers with. */
export function buildContactMessage(draft: ContactDraft) {
  const name = tidy(draft.name);
  const message = tidy(draft.message);

  return sentences([
    name ? `Hello, this is ${name}.` : "Hello Standard Furniture.",
    message,
  ]);
}

export function contactIsReady(draft: ContactDraft) {
  return Boolean(tidy(draft.name) || tidy(draft.message));
}

export type AssistantHandoff = {
  /** What the visitor asked the assistant. */
  question: string;
  /** The product the reply led with, when it cited one. */
  productName?: string;
};

/**
 * The handoff from the assistant to a person.
 *
 * The assistant is not the conversion path — WhatsApp is — so every reply ends
 * up next to a link, and the link has to arrive carrying context. Two things
 * make that message worth reading at the shop's end: the product, if the
 * answer was about one, and the visitor's own question, which is usually
 * phrased better than any summary of it.
 *
 * The question is quoted rather than paraphrased. It arrives from a chat box
 * as a whole sentence with its own punctuation, and the tidy() pass is enough
 * — rewriting it into a third-person summary would lose the detail ("would it
 * fit a narrow room?") that makes the message answerable.
 */
export function buildAssistantHandoffMessage(handoff: AssistantHandoff) {
  const question = tidy(handoff.question);
  const productName = handoff.productName ? tidy(handoff.productName) : "";

  return sentences([
    productName
      ? `Hello, I was reading about the ${productName} on your website.`
      : "Hello, I was using the assistant on your website.",
    question && `I asked: ${question}`,
  ]);
}
