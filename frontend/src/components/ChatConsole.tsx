import {
  ArrowUp,
  Check,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  Copy,
  CornerDownRight,
  Database,
  ExternalLink,
  FilePlus2,
  Hash,
  Headset,
  LoaderCircle,
  Mail,
  Menu,
  MessagesSquare,
  PanelRight,
  Paperclip,
  Phone,
  Sparkles,
  TriangleAlert,
  UploadCloud,
  UserRound,
  Users,
} from "lucide-react";
import { DragEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";

import { type Starter, STARTERS } from "../lib/starters";
import { ACCEPTED_FILES, type UploadStatus } from "../lib/useDocuments";
import type {
  ChatMessage,
  Citation,
  SupportChannel,
  SupportKind,
  SupportRequest,
  ToolResult,
} from "../types";

type ChatConsoleProps = {
  title: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  documentCount: number;
  uploadStatus: UploadStatus | null;
  inspectorOpen: boolean;
  /** Only knowledge base admins may add documents and see the retrieval trace. */
  canUpload: boolean;
  requests: SupportRequest[];
  channels: SupportChannel[];
  onSend: (message: string) => void;
  onSupportRequest: (kind: SupportKind, message: ChatMessage) => Promise<void>;
  onUpload: (files: FileList | null) => void;
  onToggleInspector: () => void;
  onOpenSidebar: () => void;
  /** Replaces the default top bar, e.g. with the embedded widget's header. */
  header?: ReactNode;
  starters?: Starter[];
  greeting?: string;
  /** Replaces the keyboard hint under the composer. */
  hint?: string;
  placeholder?: string;
};

export function ChatConsole({
  title,
  messages,
  isStreaming,
  documentCount,
  uploadStatus,
  inspectorOpen,
  canUpload,
  requests,
  channels,
  onSend,
  onSupportRequest,
  onUpload,
  onToggleInspector,
  onOpenSidebar,
  header,
  starters = STARTERS.default,
  greeting = "What do you want to know?",
  hint,
  placeholder = "Ask about your documents...",
}: ChatConsoleProps) {
  const [draft, setDraft] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastAnswerId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

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
        if (canUpload && event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setIsDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {header ?? (
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
          {canUpload && (
            <button
              type="button"
              className={`toggle ${inspectorOpen ? "on" : ""}`}
              onClick={onToggleInspector}
              title="Show retrieval trace"
            >
              <PanelRight size={16} />
              <span>Trace</span>
            </button>
          )}
        </header>
      )}

      <div className="messages" ref={scrollRef}>
        <div className="thread">
          {messages.length === 0 ? (
            <EmptyState
              greeting={greeting}
              starters={starters}
              disabled={isStreaming}
              onPick={send}
            />
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <article className="message user" key={message.id}>
                  <div className="bubble">{message.content}</div>
                </article>
              ) : message.role === "agent" ? (
                <article className="message agent" key={message.id}>
                  <div className="avatar agent">
                    <Headset size={16} />
                  </div>
                  <div className="answer">
                    <span className="agent-label">Support team · replied in this chat</span>
                    <div className="agent-bubble">{message.content}</div>
                  </div>
                </article>
              ) : (
                <article className="message assistant" key={message.id}>
                  <div className="avatar">
                    <Sparkles size={16} />
                  </div>
                  <AssistantMessage
                    message={message}
                    isStreaming={isStreaming}
                    nextSteps={
                      message.id === lastAnswerId && !isStreaming ? (
                        <NextSteps
                          message={message}
                          requests={requests}
                          channels={channels}
                          onAsk={send}
                          onRequest={(kind) => onSupportRequest(kind, message)}
                        />
                      ) : null
                    }
                  />
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
        <form className={`composer ${canUpload ? "" : "no-attach"}`} onSubmit={handleSubmit}>
          {canUpload && (
            <button
              type="button"
              className="icon-button ghost"
              title="Add a document to the knowledge base"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={18} />
            </button>
          )}
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
            placeholder={placeholder}
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
        <p className={`composer-hint ${hint ? "custom" : ""}`}>
          {hint ?? (
            <>
              Enter to send · Shift + Enter for a new line
              {canUpload && " · drop files anywhere to add them to the knowledge base"}
            </>
          )}
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

function EmptyState({
  greeting,
  starters,
  disabled,
  onPick,
}: {
  greeting: string;
  starters: Starter[];
  disabled: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="empty-state">
      <div className="hero-mark">
        <Sparkles size={26} />
      </div>
      <h3>{greeting}</h3>
      <p>
        Answers cite the exact passage they come from. If the documents don't cover a question,
        the assistant says so instead of guessing.
      </p>
      <div className="suggestions">
        {starters.map(({ icon: Icon, kind, tone, text }) => (
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
  nextSteps,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  nextSteps: ReactNode;
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
          {message.answerMode !== undefined && message.answerMode !== "llm" && (
            <span>Quoted directly from the sources</span>
          )}
        </div>
      )}

      {isDone && !failed && message.route !== "ticket" && nextSteps}
    </div>
  );
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  slack: Hash,
  teams: Users,
  phone: Phone,
};

/**
 * What to do after an answer: follow-up questions the documents can answer, and ways to reach a
 * person. A "not in the documents" answer leads with requesting the document.
 */
function NextSteps({
  message,
  requests,
  channels,
  onAsk,
  onRequest,
}: {
  message: ChatMessage;
  requests: SupportRequest[];
  channels: SupportChannel[];
  onAsk: (question: string) => void;
  onRequest: (kind: SupportKind) => Promise<void>;
}) {
  const [showChannels, setShowChannels] = useState(false);
  const [pending, setPending] = useState<SupportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noAnswer = message.route === "no_answer";
  const suggestions = message.suggestions || [];
  const requested = (kind: SupportKind) =>
    requests.find((item) => item.kind === kind && item.message_id === message.serverId);
  const docsRequest = requested("docs");
  const humanRequest = requested("human");
  const waiting = [docsRequest, humanRequest].some((item) => item?.status === "open");

  async function request(kind: SupportKind) {
    setPending(kind);
    setError(null);
    try {
      await onRequest(kind);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the request.");
    } finally {
      setPending(null);
    }
  }

  function requestButton(kind: SupportKind, existing: SupportRequest | undefined) {
    const Icon = kind === "docs" ? FilePlus2 : UserRound;
    const label = existing
      ? existing.status === "open"
        ? kind === "docs"
          ? "Document requested"
          : "Waiting for a person"
        : "Answered below"
      : kind === "docs"
        ? "Request this document"
        : "Talk to a person";
    return (
      <button
        type="button"
        className={`handoff-button ${existing ? "done" : ""} ${kind === "docs" ? "primary" : ""}`}
        disabled={Boolean(existing) || pending !== null || !message.serverId}
        onClick={() => void request(kind)}
      >
        {pending === kind ? (
          <LoaderCircle className="spin" size={14} />
        ) : existing ? (
          <CircleCheck size={14} />
        ) : (
          <Icon size={14} />
        )}
        {label}
      </button>
    );
  }

  return (
    <div className="next-steps">
      {suggestions.length > 0 && (
        <div className="follow-ups">
          <p className="sources-label">{noAnswer ? "The documents do cover" : "Ask next"}</p>
          <div className="follow-up-list">
            {suggestions.map((question) => (
              <button
                type="button"
                className="follow-up"
                key={question}
                onClick={() => onAsk(question)}
              >
                <CornerDownRight size={14} />
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`handoff ${noAnswer ? "prominent" : ""}`}>
        <span className="handoff-label">
          {noAnswer ? "Need this answered?" : "Not what you needed?"}
        </span>
        <div className="handoff-actions">
          {noAnswer && requestButton("docs", docsRequest)}
          {requestButton("human", humanRequest)}
          {channels.length > 0 && (
            <button
              type="button"
              className={`handoff-button ${showChannels ? "open" : ""}`}
              aria-expanded={showChannels}
              onClick={() => setShowChannels((current) => !current)}
            >
              <MessagesSquare size={14} />
              Other channels
              <ChevronDown size={14} className="chevron" />
            </button>
          )}
        </div>
        {showChannels && (
          <div className="channels">
            {channels.map((channel) => {
              const Icon = CHANNEL_ICONS[channel.kind] || ExternalLink;
              return (
                <a
                  key={channel.href}
                  className="channel"
                  href={channel.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Icon size={14} />
                  {channel.label}
                </a>
              );
            })}
          </div>
        )}
        {waiting && (
          <p className="handoff-status">
            <span className="live-dot" />
            {docsRequest?.status === "open"
              ? "The knowledge team has your request. Their reply will show up in this chat."
              : "A person from the support team will reply in this chat."}
          </p>
        )}
        {error && <p className="status error">{error}</p>}
      </div>
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
    .map((match) => match[1]);
  const passage = cleanPassage(citation.text).split(/(?<=[.!?])\s+/);

  // Models often cite a whole paragraph at its end. Its first sentence states the answer,
  // so match claim sentences in order and quote for the first one that matches anything.
  for (const claim of (claims.length ? claims : [answer]).flatMap(splitSentences)) {
    const claimWords = contentWords(claim);
    let best: string | null = null;
    let bestScore = 0;
    for (const sentence of passage) {
      const words = contentWords(sentence);
      const shared = [...words].filter((word) => claimWords.has(word));
      // A shared number ("25 percent") pins the sentence far better than shared prose.
      const overlap = shared.reduce((sum, word) => sum + (/^\d+$/.test(word) ? 3 : 1), 0);
      // Normalise by length so a long run-on sentence does not win on size alone.
      const score = shared.length < 2 ? 0 : overlap / Math.sqrt(words.size);
      if (score > bestScore) {
        best = sentence.trim();
        bestScore = score;
      }
    }
    if (best) return best;
  }
  return null;
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter((part) => part.trim());
}

/**
 * Drop markdown heading and bullet markers that chunking flattened into the passage, a PDF page
 * footer ("Page 2") at the start, and the sentence fragment a chunk can start with ("according
 * to these tiers. Uptime from ...").
 */
function cleanPassage(text: string | null | undefined): string {
  const cleaned = (text || "")
    .replace(/(^|\s)(#{1,6}|-)\s+/g, "$1")
    .replace(/^\s*Page \d+\s+/, "")
    .trim();
  const fragment = /^[a-z][^.!?]{0,120}[.!?]\s+(?=[A-Z])/.exec(cleaned);
  return fragment ? cleaned.slice(fragment[0].length) : cleaned;
}

function contentWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  return new Set(words.filter((word) => word.length > 2 && !STOPWORDS.has(word)));
}
