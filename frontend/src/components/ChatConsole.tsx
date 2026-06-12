import { LoaderCircle, Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "../types";

type ChatConsoleProps = {
  messages: ChatMessage[];
  route: string;
  isStreaming: boolean;
  onSend: (message: string) => void;
};

export function ChatConsole({ messages, route, isStreaming, onSend }: ChatConsoleProps) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isStreaming) return;
    setDraft("");
    onSend(message);
  }

  return (
    <section className="workspace" aria-label="Chat">
      <header className="topbar">
        <div>
          <h2>Assistant Console</h2>
          <p>Traceable business answers</p>
        </div>
        <div className="route-pill">
          {isStreaming && <LoaderCircle className="spin" size={14} />}
          <span>route: {route}</span>
        </div>
      </header>

      <div className="messages" ref={scrollRef}>
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="avatar">{message.role === "user" ? "You" : "AI"}</div>
            <div className="bubble">{message.content || (isStreaming ? "..." : "")}</div>
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={draft}
          rows={3}
          placeholder="Ask about policy, revenue, SLA, or create a ticket..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={isStreaming || !draft.trim()}>
          <Send size={17} />
          Send
        </button>
      </form>
    </section>
  );
}

