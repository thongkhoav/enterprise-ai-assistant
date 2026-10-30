import { useCallback, useEffect, useState } from "react";

import {
  deleteConversation as apiDeleteConversation,
  getConversation,
  listConversations,
  streamChat,
} from "../api/client";
import type {
  ApiMessage,
  ChatMessage,
  Citation,
  ConversationSummary,
  Settings,
  ToolResult,
} from "../types";
import { newId } from "./ids";

export type Trace = {
  route: string;
  traceId: string;
  citations: Citation[];
  toolResults: ToolResult[];
  latencyMs: number | null;
  answerMode: string | null;
};

const EMPTY_TRACE: Trace = {
  route: "none",
  traceId: "none",
  citations: [],
  toolResults: [],
  latencyMs: null,
  answerMode: null,
};

/**
 * Conversations and the streaming chat, shared by the full app and the embedded widget.
 * `trace` mirrors the latest answer for the admin trace panel.
 */
export function useChat(settings: Settings, token: string | null) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [trace, setTrace] = useState<Trace>(EMPTY_TRACE);

  const refreshConversations = useCallback(async () => {
    if (!token) return;
    try {
      setConversations(await listConversations(settings, token));
    } catch {
      // The list is navigation only; the open chat keeps working.
    }
  }, [settings, token]);

  useEffect(() => {
    // A new or cleared session starts from an empty chat.
    setConversations([]);
    setActiveConversationId(null);
    setMessages([]);
    setTrace(EMPTY_TRACE);
    void refreshConversations();
  }, [refreshConversations]);

  function newChat() {
    setActiveConversationId(null);
    setMessages([]);
    setTrace(EMPTY_TRACE);
  }

  async function selectConversation(id: string) {
    if (!token) return;
    try {
      const detail = await getConversation(settings, token, id);
      setActiveConversationId(detail.id);
      setMessages(detail.messages.map(toChatMessage));
      setTrace(traceFrom(detail.messages));
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

  /** Reload the open conversation, e.g. when the support team replied in it. */
  function reloadIfOpen(conversationId: string) {
    if (conversationId === activeConversationId && !isStreaming) {
      void selectConversation(conversationId);
    }
  }

  async function deleteConversation(id: string) {
    if (!token) return;
    try {
      await apiDeleteConversation(settings, token, id);
      await refreshConversations();
      if (id === activeConversationId) newChat();
    } catch {
      // Keep the current view; deletion failures are non-fatal for the UI.
    }
  }

  /** The user question an answer replied to, used when handing the answer to a person. */
  function questionFor(message: ChatMessage): string {
    const index = messages.findIndex((item) => item.id === message.id);
    const question = messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user")?.content;
    return question || message.content;
  }

  async function send(text: string) {
    if (!token) return;

    const assistantId = newId("assistant");
    const update = (patch: (item: ChatMessage) => Partial<ChatMessage>) =>
      setMessages((current) =>
        current.map((item) => (item.id === assistantId ? { ...item, ...patch(item) } : item)),
      );

    setMessages((current) => [
      ...current,
      { id: newId("user"), role: "user", content: text },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);
    setTrace({ ...EMPTY_TRACE, route: "thinking", traceId: "pending" });

    try {
      await streamChat(settings, token, activeConversationId, text, (event) => {
        if (event.type === "suggestions") {
          update(() => ({ suggestions: event.questions }));
          return;
        }
        if (event.type === "token") {
          update((item) => ({ content: item.content + event.text }));
          return;
        }

        update((item) => ({
          serverId: event.message_id,
          content: item.content.trim(),
          route: event.route,
          citations: event.citations,
          latencyMs: event.latency_ms,
          answerMode: event.answer_mode,
          toolResults: event.tool_results || [],
        }));
        setTrace({
          route: event.route,
          traceId: event.trace_id,
          citations: event.citations,
          toolResults: event.tool_results || [],
          latencyMs: event.latency_ms ?? null,
          answerMode: event.answer_mode ?? null,
        });
        setActiveConversationId(event.conversation_id);
        void refreshConversations();
      });
    } catch (error) {
      update(() => ({
        route: "error",
        content: error instanceof Error ? error.message : "Request failed.",
      }));
    } finally {
      setIsStreaming(false);
    }
  }

  return {
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    trace,
    send,
    newChat,
    selectConversation,
    reloadIfOpen,
    deleteConversation,
    questionFor,
  };
}

function toChatMessage(message: ApiMessage): ChatMessage {
  return {
    id: message.id,
    serverId: message.id,
    role: message.role === "system" ? "assistant" : message.role,
    content: message.content,
    route: message.route || undefined,
    citations: message.citations || [],
    toolResults: message.tool_results || [],
    suggestions: message.suggestions || [],
  };
}

function traceFrom(messages: ApiMessage[]): Trace {
  const last = [...messages].reverse().find((message) => message.role === "assistant");
  if (!last) return EMPTY_TRACE;
  return {
    ...EMPTY_TRACE,
    route: last.route || "none",
    traceId: last.trace_id || "none",
    citations: last.citations || [],
    toolResults: last.tool_results || [],
  };
}
