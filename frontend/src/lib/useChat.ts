import { useCallback, useEffect, useRef, useState } from "react";

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
  ConversationDetail,
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

export type ChatOptions = {
  /** Conversation to open once signed in: a shared link, or the widget's previous page. */
  initialConversationId?: string | null;
  /** Called when that conversation cannot be opened (deleted, or another user's). */
  onInitialMissing?: () => void;
  /** The widget shows no conversation list, so it can skip fetching one. */
  listConversations?: boolean;
};

/**
 * Conversations and the streaming chat, shared by the full app and the embedded widget.
 * `trace` mirrors the latest answer for the admin trace panel.
 */
export function useChat(settings: Settings, token: string | null, options: ChatOptions = {}) {
  const { initialConversationId = null, listConversations: withList = true } = options;
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [trace, setTrace] = useState<Trace>(EMPTY_TRACE);
  // Read by `send` after it awaits, when the rendered value may be stale.
  const activeRef = useRef<string | null>(null);
  // Sends wait for the initial conversation, so a question asked while it loads joins it
  // instead of being overwritten when it arrives.
  const initialLoad = useRef<Promise<void>>(Promise.resolve());
  const initialDone = useRef(false);
  // Bumped when the user opens or starts a chat, so a late initial load does not replace it.
  const choice = useRef(0);
  // Sends run one at a time, in order: two quick "Ask about this" clicks are two questions.
  const sendQueue = useRef<Promise<void>>(Promise.resolve());
  const queued = useRef(0);
  const onMissingRef = useRef(options.onInitialMissing);
  onMissingRef.current = options.onInitialMissing;

  function setActive(id: string | null) {
    activeRef.current = id;
    setActiveConversationId(id);
  }

  function show(detail: ConversationDetail) {
    setActive(detail.id);
    setMessages(detail.messages.map(toChatMessage));
    setTrace(traceFrom(detail.messages));
  }

  const refreshConversations = useCallback(async () => {
    if (!token || !withList) return;
    try {
      setConversations(await listConversations(settings, token));
    } catch {
      // The list is navigation only; the open chat keeps working.
    }
  }, [settings, token, withList]);

  useEffect(() => {
    // A new or cleared session starts from an empty chat, or from the initial conversation.
    setConversations([]);
    setActive(null);
    setMessages([]);
    setTrace(EMPTY_TRACE);
    void refreshConversations();

    if (!token || !initialConversationId || initialDone.current) {
      initialLoad.current = Promise.resolve();
      return;
    }
    // Marked done only when settled: React's dev double-run cancels the first attempt.
    let cancelled = false;
    const chosen = choice.current;
    initialLoad.current = getConversation(settings, token, initialConversationId)
      .then((detail) => {
        if (cancelled) return;
        initialDone.current = true;
        if (choice.current === chosen) show(detail);
      })
      .catch(() => {
        if (cancelled) return;
        initialDone.current = true;
        onMissingRef.current?.();
      });
    return () => {
      cancelled = true;
    };
    // `show` and `setActive` only call state setters, so they are not dependencies.
  }, [refreshConversations, settings, token, initialConversationId]);

  function newChat() {
    choice.current += 1;
    setActive(null);
    setMessages([]);
    setTrace(EMPTY_TRACE);
  }

  async function selectConversation(id: string) {
    if (!token) return;
    choice.current += 1;
    try {
      show(await getConversation(settings, token, id));
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

  function send(text: string): Promise<void> {
    if (!token) return Promise.resolve();
    // Busy from the moment it is queued, so the composer cannot fire again meanwhile.
    queued.current += 1;
    setIsStreaming(true);
    const run = sendQueue.current
      .then(() => initialLoad.current)
      .then(() => streamAnswer(token, text))
      .finally(() => {
        queued.current -= 1;
        setIsStreaming(queued.current > 0);
      });
    sendQueue.current = run.catch(() => {});
    return run;
  }

  async function streamAnswer(token: string, text: string) {
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
    setTrace({ ...EMPTY_TRACE, route: "thinking", traceId: "pending" });

    try {
      await streamChat(settings, token, activeRef.current, text, (event) => {
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
        setActive(event.conversation_id);
        void refreshConversations();
      });
    } catch (error) {
      update(() => ({
        route: "error",
        content: error instanceof Error ? error.message : "Request failed.",
      }));
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
