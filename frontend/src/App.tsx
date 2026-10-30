import { useEffect, useRef, useState } from "react";

import { switchRole } from "./api/client";
import { AuthScreen } from "./components/AuthScreen";
import { ChatConsole } from "./components/ChatConsole";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { loadSettings } from "./lib/settings";
import { useChat } from "./lib/useChat";
import { useDocuments } from "./lib/useDocuments";
import { useSession } from "./lib/useSession";
import { useSupport } from "./lib/useSupport";
import type { ChatMessage, Settings, SupportKind, UserRole } from "./types";

export function App() {
  const [settings] = useState<Settings>(() => loadSettings());
  const session = useSession(settings);
  const { token, user } = session;
  const chat = useChat(settings, token);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const knowledge = useDocuments(settings, token);
  const isAdmin = user?.role === "admin";
  // A reply from the support team lands in a conversation; reload it if it is open.
  const reloadRef = useRef<(conversationId: string) => void>(() => {});
  reloadRef.current = chat.reloadIfOpen;
  const support = useSupport(settings, token, isAdmin, (request) => {
    if (request.conversation_id) reloadRef.current(request.conversation_id);
  });

  // "Open in a full window" from the widget links here with ?conversation=<id>.
  const opened = useRef(false);
  const selectRef = useRef(chat.selectConversation);
  selectRef.current = chat.selectConversation;
  useEffect(() => {
    if (!token || opened.current) return;
    opened.current = true;
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (!id) return;
    window.history.replaceState(null, "", window.location.pathname);
    void selectRef.current(id);
  }, [token]);

  async function handleSwitchRole(role: UserRole) {
    if (!token) return;
    try {
      session.setUser(await switchRole(settings, token, role));
    } catch {
      // The toggle only exists when the server allows switching.
    }
  }

  /** Hand an answer to a person: the question is the user message it replied to. */
  async function handleSupportRequest(kind: SupportKind, message: ChatMessage) {
    await support.create(
      kind,
      chat.questionFor(message),
      chat.activeConversationId,
      message.serverId,
    );
  }

  if (!token) {
    return <AuthScreen settings={settings} onAuthenticated={session.authenticate} />;
  }

  const activeTitle =
    chat.conversations.find((conversation) => conversation.id === chat.activeConversationId)
      ?.title || "New chat";

  return (
    <main className={`shell ${inspectorOpen && isAdmin ? "with-inspector" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        user={user}
        conversations={chat.conversations}
        activeConversationId={chat.activeConversationId}
        isAdmin={isAdmin}
        documents={knowledge.documents}
        uploadStatus={knowledge.status}
        isUploading={knowledge.isUploading}
        requests={support.requests}
        onResolveRequest={support.resolve}
        onSwitchRole={(role) => void handleSwitchRole(role)}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          chat.newChat();
          setSidebarOpen(false);
        }}
        onSelectConversation={(id) => {
          void chat.selectConversation(id);
          setSidebarOpen(false);
        }}
        onDeleteConversation={(id) => void chat.deleteConversation(id)}
        onUpload={(files) => void knowledge.upload(files)}
        onDeleteDocument={(id) => void knowledge.remove(id)}
        onLogout={session.logout}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
      <ChatConsole
        title={activeTitle}
        messages={chat.messages}
        isStreaming={chat.isStreaming}
        documentCount={knowledge.documents.length}
        uploadStatus={knowledge.status}
        inspectorOpen={inspectorOpen}
        canUpload={isAdmin}
        requests={support.requests}
        channels={support.channels}
        onSend={(text) => void chat.send(text)}
        onSupportRequest={handleSupportRequest}
        onUpload={(files) => void knowledge.upload(files)}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
      <Inspector
        open={inspectorOpen && isAdmin}
        onClose={() => setInspectorOpen(false)}
        route={chat.trace.route}
        traceId={chat.trace.traceId}
        citations={chat.trace.citations}
        toolResults={chat.trace.toolResults}
        latencyMs={chat.trace.latencyMs}
        answerMode={chat.trace.answerMode}
      />
    </main>
  );
}
