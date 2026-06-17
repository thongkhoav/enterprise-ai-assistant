import { useCallback, useEffect, useState } from "react";

import {
  deleteConversation as apiDeleteConversation,
  fetchMe,
  getConversation,
  listConversations,
  streamChat,
} from "./api/client";
import { AuthScreen } from "./components/AuthScreen";
import { ChatConsole } from "./components/ChatConsole";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { clearToken, getToken, setToken } from "./lib/auth";
import { newId } from "./lib/ids";
import { loadSettings } from "./lib/settings";
import type {
  ApiMessage,
  AuthUser,
  ChatMessage,
  Citation,
  ConversationSummary,
  Settings,
  ToolResult,
} from "./types";

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Ready.",
  },
];

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
  }

  function applyInspectorFromMessages(apiMessages: ApiMessage[]) {
    const lastAssistant = [...apiMessages].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      setRoute(lastAssistant.route || "none");
      setTraceId(lastAssistant.trace_id || "none");
      setCitations(lastAssistant.citations || []);
      setToolResults(lastAssistant.tool_results || []);
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
              role: message.role === "assistant" ? "assistant" : "user",
              content: message.content,
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

    setMessages((current) => {
      const base = current.length === 1 && current[0].id === "welcome" ? [] : current;
      return [...base, userMessage, assistantMessage];
    });
    setIsStreaming(true);
    setRoute("streaming");
    setTraceId("pending");
    setCitations([]);
    setToolResults([]);

    try {
      await streamChat(settings, token, activeConversationId, message, (event) => {
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

        setRoute(event.route);
        setTraceId(event.trace_id);
        setCitations(event.citations);
        setToolResults(event.tool_results || []);
        setActiveConversationId(event.conversation_id);
        void refreshConversations();
      });
    } catch (error) {
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? { ...item, content: error instanceof Error ? error.message : "Request failed." }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  if (!token) {
    return (
      <AuthScreen settings={settings} onAuthenticated={handleAuthenticated} />
    );
  }

  return (
    <main className="shell">
      <Sidebar
        settings={settings}
        token={token}
        user={user}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onPrompt={handleSend}
        onLogout={handleLogout}
      />
      <ChatConsole
        messages={messages}
        route={route}
        isStreaming={isStreaming}
        onSend={handleSend}
      />
      <Inspector route={route} traceId={traceId} citations={citations} toolResults={toolResults} />
    </main>
  );
}
