"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Open state for the GLOBAL chat drawer.
 *
 * Deliberately small. It used to carry a registered `askAbout` handler as
 * well, so the product page could reach into the drawer and seed it — that is
 * gone, because the product assistant is now its own centred modal owned by
 * the product page itself (components/chat/product-chat-modal.tsx). Nothing
 * crosses the tree any more except "is the drawer open".
 *
 * It stays a context rather than collapsing back into ChatWidget's own
 * useState because the drawer is the site-wide entry point, and a header or
 * nav trigger for it is the obvious next thing to want. One boolean in a
 * provider is a cheap place to leave that door open.
 *
 * The provider is a Client Component, but the pages inside it are NOT. It
 * takes `children` as a prop, so everything nested in it stays server-rendered.
 */

type ChatControls = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const ChatContext = createContext<ChatControls | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/**
 * Throws when used outside the provider rather than returning a no-op. A
 * silently inert launcher is worse than a crash in development: it looks like
 * it works.
 */
export function useChat() {
  const controls = useContext(ChatContext);
  if (!controls) {
    throw new Error("useChat must be used inside <ChatProvider>");
  }
  return controls;
}
