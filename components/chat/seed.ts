/**
 * The opening message a product page asks on the customer's behalf.
 *
 * Its own module, with no imports, because three unrelated places need to
 * agree on the exact string: the product modal that sends it, the conversation
 * that recognises it to avoid asking twice, and scripts/test-chat.ts, which
 * asserts the whole seeded flow. A near-copy in any one of them would break
 * the deduplication silently — the modal would re-ask on every open and only
 * the Groq bill would notice.
 *
 * NOTE ON GROUNDING. This is the entire "context" the product button passes.
 * It is a sentence containing a name that came out of the database, sent
 * through POST /api/chat like anything a customer types, so the assistant
 * answers it by retrieving the product for real. There is no context
 * side-channel and no second path into the model.
 */
export function seedMessage(productName: string) {
  return `Tell me about the ${productName}`;
}
