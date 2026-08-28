import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { whatsappUrl } from "@/lib/site";

/**
 * The draft, and the handoff to WhatsApp.
 *
 * Shared by both form pages so the honesty copy exists ONCE. That sentence —
 * "you still press send" — is the promise these pages make, and two copies of
 * a promise is one copy waiting to be edited into something weaker.
 *
 * Everything here follows from a single fact: nothing is submitted. The page
 * composes text and opens a chat; the customer sends it, or doesn't, in an app
 * we cannot see. So:
 *
 *   - the exact message is shown before the tap, not summarised,
 *   - the button names the action (opens WhatsApp) rather than implying
 *     delivery ("Send", "Submit"),
 *   - and there is no success state anywhere, because we never learn whether
 *     the message was sent.
 *
 * RESTYLED ONLY. Every rule above still holds and every string is unchanged.
 * The preview is now the same tinted panel the AI summary and the catalogue's
 * CTA use, and the draft is set in Inter rather than the old mono spec face —
 * it is a message someone is about to send a person, and it should look like
 * one. `whitespace-pre-line` stays, because the line breaks are the message's.
 */
export function WhatsAppHandoff({
  message,
  ready,
  emptyHint,
  label = "Message us on WhatsApp",
}: {
  /** The composed draft. Ignored for display when `ready` is false. */
  message: string;
  ready: boolean;
  /** What to say in the preview panel before there is anything to preview. */
  emptyHint: string;
  label?: string;
}) {
  return (
    <div>
      <div className="rounded-xl border border-hairline bg-surface p-6 sm:p-8">
        <h3 className="text-sm font-semibold text-ink">Your message</h3>

        {/* polite, not assertive: the draft updates on every keystroke and
            should not interrupt someone mid-sentence. */}
        <p
          aria-live="polite"
          className="mt-3 leading-relaxed whitespace-pre-line text-ink"
        >
          {ready ? message : <span className="text-muted">{emptyHint}</span>}
        </p>
      </div>

      <div className="mt-5">
        {ready ? (
          <Button href={whatsappUrl(message)} className="w-full sm:w-auto">
            <WhatsAppIcon />
            {label}
          </Button>
        ) : (
          // Not `disabled`: a disabled button leaves the tab order, so a
          // keyboard user would never find it or hear why it is not ready.
          //
          // Dimmed with `opacity-50` rather than by overriding the variant's
          // background. Two background utilities on one element are resolved
          // by CSS source order, not by the order they are written — the same
          // trap that silently swallowed the review form's error border. An
          // opacity utility competes with nothing.
          <Button
            aria-disabled="true"
            className="w-full cursor-not-allowed opacity-50 hover:bg-ink sm:w-auto"
          >
            <WhatsAppIcon />
            {label}
          </Button>
        )}

        <p className="mt-3 text-sm leading-relaxed text-muted">
          Opens WhatsApp with the message above already written. You still press
          send — nothing leaves this page.
        </p>
      </div>
    </div>
  );
}
