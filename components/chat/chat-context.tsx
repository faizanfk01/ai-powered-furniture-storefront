"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * The handle a page uses to reach the chat panel.
 *
 * The widget is mounted once in app/(storefront)/layout.tsx; the "Ask AI about
 * this piece" button lives on the product page, several layers down a
 * different tree. Something has to connect them, and the options were a
 * context, a global store, or a DOM event.
 *
 * Context, because the connection is typed. A `window.dispatchEvent` would
 * work and would need no provider at all, but nothing would tell you at build
 * time when the button and the widget disagreed about what a request looks
 * like — and a chat that silently fails to open is the kind of bug nobody
 * notices for a month.
 *
 * The provider is a Client Component, but the pages inside it are NOT. It
 * takes `children` as a prop, so everything nested in it stays server-rendered
 * exactly as before. The only JavaScript this adds to a page is the button
 * that uses it.
 *
 * WHY A REGISTERED CALLBACK RATHER THAN A `seed` VALUE. The first version of
 * this file published a `{ productName, nonce }` object and let the widget
 * watch it with an effect. That works, and it is the wrong shape: reacting to
 * it meant calling setState synchronously inside an effect body, which is a
 * cascading render and which this project's lint config rejects outright.
 *
 * Handing the widget a place to register what should happen instead turns the
 * whole thing back into what it actually is — a click calling a function. The
 * ref is an external system being synchronised, which is what effects are for;
 * the state updates then happen in an event handler, where they belong.
 */

type AskHandler = (productName: string) => void;

type ChatControls = {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Open the panel and ask about this product. Called by the product page. */
  askAbout: AskHandler;
  /**
   * The widget calls this to say what `askAbout` should do. Stored in a ref,
   * so re-registering on each render costs nothing and never re-renders
   * anything that consumes this context.
   */
  registerAsk: (handler: AskHandler) => void;
};

const ChatContext = createContext<ChatControls | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const askHandler = useRef<AskHandler | null>(null);

  const registerAsk = useCallback((handler: AskHandler) => {
    askHandler.current = handler;
  }, []);

  const askAbout = useCallback((productName: string) => {
    setOpen(true);
    // Null only if the button somehow renders before the widget's registration
    // effect has run. Opening the panel on its entry state is a sane thing to
    // be left with, so this stays optional rather than throwing.
    askHandler.current?.(productName);
  }, []);

  const value = useMemo(
    () => ({ open, setOpen, askAbout, registerAsk }),
    [open, askAbout, registerAsk],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/**
 * Throws when used outside the provider rather than returning a no-op.
 *
 * A silently inert "Ask AI" button is worse than a crash in development: it
 * looks like it works. The only way to hit this is to render a consumer
 * outside the storefront layout, which is a wiring mistake, not a runtime
 * condition.
 */
export function useChat() {
  const controls = useContext(ChatContext);
  if (!controls) {
    throw new Error("useChat must be used inside <ChatProvider>");
  }
  return controls;
}

/**
 * The opening message, composed from the product's real name.
 *
 * Exported so the widget can recognise a question it has already asked and
 * reopen the conversation instead of asking it twice — the two call sites have
 * to agree on the exact string for that comparison to work.
 *
 * NOTE ON GROUNDING. This is the only thing the button "seeds", and it is just
 * a sentence containing a name that came out of the database. It travels
 * through POST /api/chat like anything a customer types, so the assistant
 * answers it by retrieving the product for real. There is no context
 * side-channel and no second path into the model — measured before it was
 * built: the product name ranks above 1.0 on the trigram search, and the
 * follow-ups that matter ("what is it made of?", "does it come in grey?")
 * resolve against it through ordinary conversation history.
 */
export function seedMessage(productName: string) {
  return `Tell me about the ${productName}`;
}
