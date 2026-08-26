import { WhatsAppIcon } from "@/components/site/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Measure } from "@/components/ui/measure";
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
      <div className="border border-hairline bg-hairline/25 p-6 sm:p-8">
        <Measure width="w-16" />
        <h3 className="spec-label mt-4 text-muted">Your message</h3>

        {/* polite, not assertive: the draft updates on every keystroke and
            should not interrupt someone mid-sentence. */}
        <p
          aria-live="polite"
          className="mt-4 font-mono text-sm leading-relaxed whitespace-pre-line text-ink"
        >
          {ready ? message : <span className="text-muted">{emptyHint}</span>}
        </p>
      </div>

      <div className="mt-6">
        {ready ? (
          <Button href={whatsappUrl(message)} className="w-full sm:w-auto">
            <WhatsAppIcon />
            {label}
          </Button>
        ) : (
          // Not `disabled`: a disabled button leaves the tab order, so a
          // keyboard user would never find it or hear why it is not ready.
          <Button
            aria-disabled="true"
            className="w-full cursor-not-allowed bg-ink/25 hover:bg-ink/25 sm:w-auto"
          >
            <WhatsAppIcon />
            {label}
          </Button>
        )}

        <p className="mt-3 text-sm text-muted">
          Opens WhatsApp with the message above already written. You still press
          send — nothing leaves this page.
        </p>
      </div>
    </div>
  );
}
