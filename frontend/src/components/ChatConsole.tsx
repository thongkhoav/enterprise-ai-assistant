import {
  ArrowUp,
  Check,
  CircleHelp,
  Copy,
  Database,
  FileText,
  LoaderCircle,
  Menu,
  PanelRight,
  Paperclip,
  ShieldQuestion,
  Sparkles,
  TicketCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";

import { ACCEPTED_FILES, type UploadStatus } from "../lib/useDocuments";
import type { ChatMessage, Citation, ToolResult } from "../types";

type ChatConsoleProps = {
  title: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  documentCount: number;
  uploadStatus: UploadStatus | null;
  inspectorOpen: boolean;
  onSend: (message: string) => void;
  onUpload: (files: FileList | null) => void;
  onToggleInspector: () => void;
  onOpenSidebar: () => void;
};

const SUGGESTIONS = [
  {
    icon: FileText,
    kind: "From the docs",
    tone: "blue",
    text: "What is the refund SLA policy?",
  },
  {
    icon: ShieldQuestion,
    kind: "Not in the docs",
    tone: "amber",
    text: "What is our parental leave policy?",
  },
  {
    icon: Database,
    kind: "Live data tool",
    tone: "green",
    text: "What is our current MRR?",
  },
  {
    icon: TicketCheck,
    kind: "Action",
    tone: "violet",
    text: "Create a high priority ticket for a failed enterprise import.",
  },
];

export function ChatConsole({
  title,
  messages,
  isStreaming,
  documentCount,
  uploadStatus,
  inspectorOpen,
  onSend,
  onUpload,
  onToggleInspector,
  onOpenSidebar,
}: ChatConsoleProps) {
  const [draft, setDraft] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
  }, [draft]);

  function send(text: string) {
    const message = text.trim();
    if (!message || isStreaming) return;
    setDraft("");
    onSend(message);
    inputRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    onUpload(event.dataTransfer.files);
  }

  return (
    <section
      className="workspace"
      aria-label="Chat"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setIsDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <header className="topbar">
        <button type="button" className="icon-button menu" onClick={onOpenSidebar}>
          <Menu size={18} />
        </button>
        <div className="topbar-title">
          <h2>{title}</h2>
          <p>
            <span className="live-dot" />
            {documentCount} documents indexed
          </p>
        </div>
        <button
          type="button"
          className={`toggle ${inspectorOpen ? "on" : ""}`}
          onClick={onToggleInspector}
          title="Show retrieval trace"
        >
          <PanelRight size={16} />
          <span>Trace</span>
        </button>
      </header>

      <div className="messages" ref={scrollRef}>
        <div className="thread">
          {messages.length === 0 ? (
            <EmptyState disabled={isStreaming} onPick={send} />
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <article className="message user" key={message.id}>
                  <div className="bubble">{message.content}</div>
                </article>
              ) : (
                <article className="message assistant" key={message.id}>
                  <div className="avatar">
                    <Sparkles size={16} />
                  </div>
                  <AssistantMessage message={message} isStreaming={isStreaming} />
                </article>
              ),
            )
          )}
        </div>
      </div>

      <div className="composer-wrap">
        {uploadStatus && (
          <p className={`toast ${uploadStatus.type}`}>
            {uploadStatus.type === "warn" && <LoaderCircle className="spin" size={14} />}
            {uploadStatus.text}
          </p>
        )}
        <form className="composer" onSubmit={handleSubmit}>
          <button
            type="button"
            className="icon-button ghost"
            title="Upload a document"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept={ACCEPTED_FILES}
            onChange={(event) => {
              onUpload(event.target.files);
              event.target.value = "";
            }}
          />
          <textarea
            ref={inputRef}
            value={draft}
            rows={1}
            placeholder="Ask about your documents..."
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(draft);
              }
            }}
          />
          <button
            type="submit"
            className="send"
            title="Send (Enter)"
            disabled={isStreaming || !draft.trim()}
          >
            {isStreaming ? <LoaderCircle className="spin" size={18} /> : <ArrowUp size={18} />}
          </button>
        </form>
        <p className="composer-hint">
          Enter to send · Shift + Enter for a new line · drop files anywhere to index them
        </p>
      </div>

      {isDragging && (
        <div className="drop-overlay">
          <UploadCloud size={36} />
          <strong>Drop to add to the knowledge base</strong>
          <span>PDF, DOCX, Markdown or text</span>
        </div>
      )}
    </section>
  );
}

function EmptyState({ disabled, onPick }: { disabled: boolean; onPick: (text: string) => void }) {
  return (
    <div className="empty-state">
      <div className="hero-mark">
        <Sparkles size={26} />
      </div>
      <h3>What do you want to know?</h3>
      <p>
        Answers cite the exact passage they come from. If the documents don't cover a question,
        the assistant says so instead of guessing.
      </p>
      <div className="suggestions">
        {SUGGESTIONS.map(({ icon: Icon, kind, tone, text }) => (
          <button
            type="button"
            className={`suggestion ${tone}`}
            key={text}
            disabled={disabled}
            onClick={() => onPick(text)}
          >
            <span className="suggestion-kind">
              <Icon size={15} />
              {kind}
            </span>
            <span className="suggestion-text">{text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantMessage({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const [openSource, setOpenSource] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const citations = message.citations || [];
  const noAnswer = message.route === "no_answer";
  const failed = message.route === "error";
  const isDone = message.route !== undefined;
  const liveData = message.route === "database" ? databaseResult(message.toolResults) : null;

  if (!message.content) {
    return (
      <div className="answer">
        {isStreaming && (
          <div className="thinking">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            Searching your documents
          </div>
        )}
      </div>
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(message.content.replace(/\s?\[(\d+|data)\]/g, ""));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="answer">
      <div className={`answer-body ${noAnswer ? "no-answer" : ""} ${failed ? "failed" : ""}`}>
        {noAnswer && (
          <span className="no-answer-label">
            <CircleHelp size={15} /> Not found in the documents
          </span>
        )}
        {failed && (
          <span className="no-answer-label">
            <TriangleAlert size={15} /> Something went wrong
          </span>
        )}
        <AnswerText
          text={message.content}
          citations={citations}
          activeSource={openSource}
          onCite={(n) => setOpenSource((current) => (current === n ? null : n))}
        />
        {!isDone && <span className="cursor" />}
      </div>

      {citations.length > 0 && (
        <div className="sources">
          <p className="sources-label">Sources</p>
          <div className="source-grid">
            {citations.map((citation) => (
              <SourceCard
                key={citation.chunk_id}
                citation={citation}
                quote={quotedSentence(citation, message.content)}
                open={openSource === citation.n}
                onToggle={() =>
                  setOpenSource((current) =>
                    current === citation.n ? null : (citation.n ?? null),
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {liveData && <DataCard data={liveData} />}

      {isDone && !failed && (
        <div className="answer-meta">
          <button type="button" className="meta-button" onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
          {message.latencyMs !== undefined && (
            <span>{(message.latencyMs / 1000).toFixed(1)}s</span>
          )}
          {citations.length > 0 && (
            <span>
              {citations.length} source{citations.length === 1 ? "" : "s"}
            </span>
          )}
          {message.answerMode === "extractive" && <span>offline extractive mode</span>}
          {message.answerMode === "fallback" && <span>LLM unavailable, quoted from the sources</span>}
        </div>
      )}
    </div>
  );
}

const MARKER = /(\[\d+\]|\[data\])/g;

function AnswerText({
  text,
  citations,
  activeSource,
  onCite,
}: {
  text: string;
  citations: Citation[];
  activeSource: number | null;
  onCite: (n: number) => void;
}) {
  const known = new Set(citations.map((citation) => citation.n));
  return (
    <span className="answer-text">
      {text.split(MARKER).map((part, index) => {
        if (part === "[data]") {
          return (
            <span className="cite data" key={index} title="Live data from the metrics tool">
              data
            </span>
          );
        }
        const match = /^\[(\d+)\]$/.exec(part);
        if (match) {
          const n = Number(match[1]);
          return known.has(n) ? (
            <button
              type="button"
              className={`cite ${activeSource === n ? "active" : ""}`}
              key={index}
              title="Show source passage"
              onClick={() => onCite(n)}
            >
              {n}
            </button>
          ) : (
            <span className="cite" key={index}>
              {n}
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}

function SourceCard({
  citation,
  quote,
  open,
  onToggle,
}: {
  citation: Citation;
  quote: string | null;
  open: boolean;
  onToggle: () => void;
}) {
  const name = citation.source.split("/").pop() || citation.source;
  const text = cleanPassage(citation.text);
  const quoteAt = quote ? text.indexOf(quote) : -1;
  return (
    <button type="button" className={`source ${open ? "open" : ""}`} onClick={onToggle}>
      <span className="source-head">
        <span className="source-n">{citation.n}</span>
        <strong>{name}</strong>
        {citation.page ? <span className="source-tag">p. {citation.page}</span> : null}
        {typeof citation.score === "number" && (
          <span className="source-score" title="Cosine similarity to the question">
            {Math.round(citation.score * 100)}%
          </span>
        )}
      </span>
      {open ? (
        <span className="source-text">
          {quoteAt === -1 ? (
            text
          ) : (
            <>
              {text.slice(0, quoteAt)}
              <mark>{quote}</mark>
              {text.slice(quoteAt + (quote?.length || 0))}
            </>
          )}
        </span>
      ) : (
        text && <span className="source-text">{quote ? `“${quote}”` : text}</span>
      )}
    </button>
  );
}

type DatabaseResult = {
  table: string;
  rows: Record<string, unknown>;
  queried_at?: string;
};

function databaseResult(toolResults: ToolResult[] | undefined): DatabaseResult | null {
  const result = toolResults?.find((item) => item.name === "query_fake_database")?.result;
  return result && typeof result.table === "string" && result.rows
    ? (result as unknown as DatabaseResult)
    : null;
}

/** The rows the metrics tool returned, so a [data] citation can be checked like a source. */
function DataCard({ data }: { data: DatabaseResult }) {
  const queriedAt = data.queried_at ? new Date(data.queried_at) : null;
  return (
    <div className="sources">
      <p className="sources-label">Live data</p>
      <div className="data-card">
        <span className="source-head">
          <span className="source-n data">
            <Database size={12} />
          </span>
          <strong>{data.table}</strong>
          {queriedAt && (
            <span className="source-tag">
              queried {queriedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </span>
        <dl className="data-rows">
          {Object.entries(data.rows).map(([key, value]) => (
            <div key={key}>
              <dt>{fieldLabel(key)}</dt>
              <dd>{typeof value === "number" ? value.toLocaleString() : String(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function fieldLabel(key: string): string {
  const label = key
    .replace(/_usd$/, " (USD)")
    .replace(/_pct$/, " (%)")
    .replace(/_7d$/, " (7 days)")
    .replace(/_/g, " ")
    .replace(/\b(mrr|sla|p95|nps|mttr)\b/g, (word) => word.toUpperCase());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "with", "that", "this", "from", "must", "should",
]);

/** The passage sentence that best matches the answer sentences citing this source. */
function quotedSentence(citation: Citation, answer: string): string | null {
  if (!citation.text || citation.n === null || citation.n === undefined) return null;

  // The claim for a marker is the text right before it: "Refunds take 5 days [1]."
  const marker = `[${citation.n}]`;
  const claims = [...answer.matchAll(/([^[\]]+)((?:\s*\[(?:\d+|data)\])+)/g)]
    .filter((match) => match[2].includes(marker))
    .map((match) => match[1])
    .join(" ");
  const claimWords = contentWords(claims || answer);

  let best: string | null = null;
  let bestScore = 0;
  for (const sentence of cleanPassage(citation.text).split(/(?<=[.!?])\s+/)) {
    const words = contentWords(sentence);
    const overlap = [...words].filter((word) => claimWords.has(word)).length;
    // Normalise by length so a long run-on sentence does not win on size alone.
    const score = overlap < 2 ? 0 : overlap / Math.sqrt(words.size);
    if (score > bestScore) {
      best = sentence.trim();
      bestScore = score;
    }
  }
  return best;
}

/** Drop markdown heading and bullet markers that chunking flattened into the passage. */
function cleanPassage(text: string | null | undefined): string {
  return (text || "").replace(/(^|\s)(#{1,6}|-)\s+/g, "$1").trim();
}

function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return new Set(words.filter((word) => word.length > 2 && !STOPWORDS.has(word)));
}
