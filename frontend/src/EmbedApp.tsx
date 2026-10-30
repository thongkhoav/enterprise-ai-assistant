import { Maximize2, SquarePen, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AuthScreen } from "./components/AuthScreen";
import { ChatConsole } from "./components/ChatConsole";
import { APP_NAME } from "./lib/brand";
import { loadSettings } from "./lib/settings";
import { startersFor } from "./lib/starters";
import { useChat } from "./lib/useChat";
import { useSession } from "./lib/useSession";
import { useSupport } from "./lib/useSupport";
import type { ChatMessage, Settings, SupportKind } from "./types";

const params = new URLSearchParams(window.location.search);
// Set by widget.js from the host page's script tag.
const CONTEXT = params.get("context");
const ASSISTANT_NAME = params.get("name") || "Ask Acme";
// Keeps the conversation when the employee moves to another page of the host site.
const CONVERSATION_KEY = "docanswer-embed-conversation";

/** Tell the host page (widget.js) something happened: ready, close, unread. */
function notifyHost(type: string): void {
  if (window.parent !== window) window.parent.postMessage({ type: `docanswer:${type}` }, "*");
}

/** The assistant inside the widget iframe: one conversation, no admin tools. */
export function EmbedApp() {
  const [settings] = useState<Settings>(() => loadSettings());
  const session = useSession(settings);
  const { token, user } = session;
  const chat = useChat(settings, token);
  const reloadRef = useRef<(conversationId: string) => void>(() => {});
  reloadRef.current = chat.reloadIfOpen;
  const support = useSupport(settings, token, false, (request) => {
    if (request.conversation_id) reloadRef.current(request.conversation_id);
    notifyHost("unread");
  });
  const sendRef = useRef(chat.send);
  sendRef.current = chat.send;

  // Restore the conversation from the previous page once signed in.
  const restored = useRef(false);
  useEffect(() => {
    if (!token || restored.current) return;
    restored.current = true;
    const saved = readSaved();
    if (saved) void chat.selectConversation(saved);
  }, [token, chat]);

  useEffect(() => {
    if (!chat.activeConversationId) return;
    try {
      sessionStorage.setItem(CONVERSATION_KEY, chat.activeConversationId);
    } catch {
      // Private mode or blocked storage: the chat just starts fresh on the next page.
    }
  }, [chat.activeConversationId]);

  // The host page can ask a question for the employee, e.g. "Ask about this page".
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.data?.type !== "docanswer:ask") return;
      const text = String(event.data.text || "").trim();
      if (text) void sendRef.current(text);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (user) notifyHost("ready");
  }, [user]);

  async function handleSupportRequest(kind: SupportKind, message: ChatMessage) {
    await support.create(
      kind,
      chat.questionFor(message),
      chat.activeConversationId,
      message.serverId,
    );
  }

  function startOver() {
    chat.newChat();
    try {
      sessionStorage.removeItem(CONVERSATION_KEY);
    } catch {
      // Nothing saved to clear.
    }
  }

  function openFullApp() {
    const query = chat.activeConversationId ? `?conversation=${chat.activeConversationId}` : "";
    window.open(`/${query}`, "_blank", "noopener");
  }

  const header = (
    <header className="embed-header">
      <span className="brand-mark small">
        <Sparkles size={15} />
      </span>
      <div className="embed-title">
        <strong>{ASSISTANT_NAME}</strong>
        <span>
          <span className="live-dot" />
          Answers from Acme's HR and IT docs
        </span>
      </div>
      <button type="button" className="icon-button ghost" title="New chat" onClick={startOver}>
        <SquarePen size={16} />
      </button>
      <button
        type="button"
        className="icon-button ghost"
        title="Open in a full window"
        onClick={openFullApp}
      >
        <Maximize2 size={16} />
      </button>
      <button
        type="button"
        className="icon-button ghost"
        title="Close"
        onClick={() => notifyHost("close")}
      >
        <X size={17} />
      </button>
    </header>
  );

  if (!token) {
    return (
      <div className="embed-shell">
        {header}
        <AuthScreen settings={settings} onAuthenticated={session.authenticate} compact />
      </div>
    );
  }

  const firstName = user?.full_name?.split(" ")[0];
  return (
    <div className="embed-shell">
      <ChatConsole
        title={ASSISTANT_NAME}
        messages={chat.messages}
        isStreaming={chat.isStreaming}
        documentCount={0}
        uploadStatus={null}
        inspectorOpen={false}
        canUpload={false}
        requests={support.requests}
        channels={support.channels}
        onSend={(text) => void chat.send(text)}
        onSupportRequest={handleSupportRequest}
        onUpload={() => {}}
        onToggleInspector={() => {}}
        onOpenSidebar={() => {}}
        header={header}
        starters={startersFor(CONTEXT)}
        greeting={firstName ? `Hi ${firstName}, how can I help?` : "How can I help?"}
        hint={`Answers cite the source · Powered by ${APP_NAME}`}
        placeholder="Ask about benefits, time off or IT..."
      />
    </div>
  );
}

function readSaved(): string | null {
  try {
    return sessionStorage.getItem(CONVERSATION_KEY);
  } catch {
    return null;
  }
}
