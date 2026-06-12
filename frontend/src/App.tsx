import { useMemo, useState } from "react";

import { streamChat } from "./api/client";
import { ChatConsole } from "./components/ChatConsole";
import { Inspector } from "./components/Inspector";
import { Sidebar } from "./components/Sidebar";
import { newId } from "./lib/ids";
import { loadSettings, saveSettings } from "./lib/settings";
import type { ApiChatMessage, ChatMessage, Citation, Settings, ToolResult } from "./types";

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: "Ready.",
  },
];

export function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);
  const [isStreaming, setIsStreaming] = useState(false);
  const [route, setRoute] = useState("none");
  const [traceId, setTraceId] = useState("none");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);

  const apiHistory = useMemo<ApiChatMessage[]>(
    () =>
      messages
        .filter((message) => message.id !== "welcome")
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  function handleSettingsChange(nextSettings: Settings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  async function handleSend(message: string) {
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
    setRoute("streaming");
    setTraceId("pending");
    setCitations([]);
    setToolResults([]);

    try {
      await streamChat(settings, message, apiHistory, (event) => {
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

  return (
    <main className="shell">
      <Sidebar settings={settings} onSettingsChange={handleSettingsChange} onPrompt={handleSend} />
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

