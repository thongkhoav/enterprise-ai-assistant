import { useCallback, useEffect, useRef, useState } from "react";

import {
  deleteConversation as apiDeleteConversation,
  fetchMe,
  getConversation,
  listConversations,
  streamChat,
  switchRole,
} from "./api/client";
import { AuthScreen } from "./components/AuthScreen";
import { ChatConsole } from "./components/ChatConsole";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { clearToken, getToken, setToken } from "./lib/auth";
import { newId } from "./lib/ids";
import { loadSettings } from "./lib/settings";
import { useDocuments } from "./lib/useDocuments";
import { useSupport } from "./lib/useSupport";
import type {
  ApiMessage,
  AuthUser,
  ChatMessage,
  Citation,
  ConversationSummary,
  Settings,
  SupportKind,
  ToolResult,
  UserRole,
} from "./types";

const STARTER_MESSAGES: ChatMessage[] = [];

export function App() {
  const [settings] = useState<Settings>(() => loadSettings());
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AuthUser | null>(null);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);
  const [isStreaming, setIsStreaming] = useState(false);
  const [route, setRoute] = useState("none");
  const [traceId, setTraceId] = useState("none");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [answerMode, setAnswerMode] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const knowledge = useDocuments(settings, token);
  const isAdmin = user?.role === "admin";
  // A reply from the support team lands in a conversation; reload it if it is open.
  const reloadRef = useRef<(conversationId: string) => void>(() => {});
  const support = useSupport(settings, token, isAdmin, (request) => {
    if (request.conversation_id) reloadRef.current(request.conversation_id);
  });

  const handleLogout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
    setConversations([]);
    setActiveConversationId(null);
    setMessages(STARTER_MESSAGES);
    setRoute("none");
    setTraceId("none");
    setCitations([]);
    setToolResults([]);
    setLatencyMs(null);
    setAnswerMode(null);
  }, []);

  function handleAuthenticated(nextToken: string) {
    setToken(nextToken);
    setTokenState(nextToken);
  }

  const refreshConversations = useCallback(async () => {
    if (!token) return [] as ConversationSummary[];
    const items = await listConversations(settings, token);
    setConversations(items);
    return items;
  }, [settings, token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      try {
        const me = await fetchMe(settings, token);
        if (cancelled) return;
        setUser(me);
        await refreshConversations();
      } catch {
        if (!cancelled) handleLogout();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, settings, refreshConversations, handleLogout]);

  function resetInspector() {
    setRoute("none");
    setTraceId("none");
    setCitations([]);
    setToolResults([]);
    setLatencyMs(null);
    setAnswerMode(null);
  }

  function applyInspectorFromMessages(apiMessages: ApiMessage[]) {
    const lastAssistant = [...apiMessages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      setRoute(lastAssistant.route || "none");
      setTraceId(lastAssistant.trace_id || "none");
      setCitations(lastAssistant.citations || []);
      setToolResults(lastAssistant.tool_results || []);
      setLatencyMs(null);
      setAnswerMode(null);
    } else {
      resetInspector();
    }
  }

  function handleNewChat() {
    setActiveConversationId(null);
    setMessages(STARTER_MESSAGES);
    resetInspector();
  }

  async function handleSelectConversation(id: string) {
    if (!token) return;
    try {
      const detail = await getConversation(settings, token, id);
      setActiveConversationId(detail.id);
      setMessages(
        detail.messages.length
          ? detail.messages.map((message) => ({
              id: message.id,
              serverId: message.id,
              role: message.role === "system" ? "assistant" : message.role,
              content: message.content,
              route: message.route || undefined,
              citations: message.citations || [],
              toolResults: message.tool_results || [],
              suggestions: message.suggestions || [],
            }))
          : STARTER_MESSAGES,
      );
      applyInspectorFromMessages(detail.messages);
    } catch (error) {
      setMessages([
        {
          id: newId("assistant"),
          role: "assistant",
          content: error instanceof Error ? error.message : "Failed to load conversation.",
        },
      ]);
    }
  }

  reloadRef.current = (conversationId) => {
    if (conversationId === activeConversationId && !isStreaming) {
      void handleSelectConversation(conversationId);
    }
  };

  async function handleSwitchRole(role: UserRole) {
    if (!token) return;
    try {
      setUser(await switchRole(settings, token, role));
    } catch {
      // The toggle only exists when the server allows switching.
    }
  }

  /** Hand an answer to a person: the question is the user message it replied to. */
  async function handleSupportRequest(kind: SupportKind, message: ChatMessage) {
    const index = messages.findIndex((item) => item.id === message.id);
    const question = messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user")?.content;
    await support.create(kind, question || message.content, activeConversationId, message.serverId);
  }

  async function handleDeleteConversation(id: string) {
    if (!token) return;
    try {
      await apiDeleteConversation(settings, token, id);
      await refreshConversations();
      if (id === activeConversationId) {
        handleNewChat();
      }
    } catch {
      // Keep current view; deletion failures are non-fatal for the UI.
    }
  }

  async function handleSend(message: string) {
    if (!token) return;

    const userMessage: ChatMessage = {
      id: newId("user"),
      role: "user",
      content: message,
    };
    const assistantId = newId("assistant");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsStreaming(true);
    setRoute("thinking");
    setTraceId("pending");
    setCitations([]);
    setToolResults([]);

    try {
      await streamChat(settings, token, activeConversationId, message, (event) => {
        if (event.type === "suggestions") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId ? { ...item, suggestions: event.questions } : item,
            ),
          );
          return;
        }
        if (event.type === "token") {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, content: item.content + event.text }
                : item,
            ),
          );
          return;
        }

        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  serverId: event.message_id,
                  content: item.content.trim(),
                  route: event.route,
                  citations: event.citations,
                  latencyMs: event.latency_ms,
                  answerMode: event.answer_mode,
                  toolResults: event.tool_results || [],
                }
              : item,
          ),
        );
        setRoute(event.route);
        setTraceId(event.trace_id);
        setLatencyMs(event.latency_ms ?? null);
        setAnswerMode(event.answer_mode ?? null);
        setCitations(event.citations);
        setToolResults(event.tool_results || []);
        setActiveConversationId(event.conversation_id);
        void refreshConversations();
      });
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                route: "error",
                content: error instanceof Error ? error.message : "Request failed.",
              }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  if (!token) {
    return <AuthScreen settings={settings} onAuthenticated={handleAuthenticated} />;
  }

  const activeTitle =
    conversations.find((conversation) => conversation.id === activeConversationId)?.title ||
    "New chat";

  return (
    <main className={`shell ${inspectorOpen && isAdmin ? "with-inspector" : ""}`}>
      <Sidebar
        open={sidebarOpen}
        user={user}
        conversations={conversations}
        activeConversationId={activeConversationId}
        isAdmin={isAdmin}
        documents={knowledge.documents}
        uploadStatus={knowledge.status}
        isUploading={knowledge.isUploading}
        requests={support.requests}
        onResolveRequest={support.resolve}
        onSwitchRole={(role) => void handleSwitchRole(role)}
        onClose={() => setSidebarOpen(false)}
        onNewChat={() => {
          handleNewChat();
          setSidebarOpen(false);
        }}
        onSelectConversation={(id) => {
          void handleSelectConversation(id);
          setSidebarOpen(false);
        }}
        onDeleteConversation={handleDeleteConversation}
        onUpload={(files) => void knowledge.upload(files)}
        onDeleteDocument={(id) => void knowledge.remove(id)}
        onLogout={handleLogout}
      />
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}
      <ChatConsole
        title={activeTitle}
        messages={messages}
        isStreaming={isStreaming}
        documentCount={knowledge.documents.length}
        uploadStatus={knowledge.status}
        inspectorOpen={inspectorOpen}
        canUpload={isAdmin}
        requests={support.requests}
        channels={support.channels}
        onSend={handleSend}
        onSupportRequest={handleSupportRequest}
        onUpload={(files) => void knowledge.upload(files)}
        onToggleInspector={() => setInspectorOpen((current) => !current)}
        onOpenSidebar={() => setSidebarOpen(true)}
      />
      <Inspector
        open={inspectorOpen && isAdmin}
        onClose={() => setInspectorOpen(false)}
        route={route}
        traceId={traceId}
        citations={citations}
        toolResults={toolResults}
        latencyMs={latencyMs}
        answerMode={answerMode}
      />
    </main>
  );
}
