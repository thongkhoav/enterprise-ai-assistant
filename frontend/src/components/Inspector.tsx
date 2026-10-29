import { Braces, FileSearch, Route, X } from "lucide-react";

import type { Citation, ToolResult } from "../types";

type InspectorProps = {
  open: boolean;
  onClose: () => void;
  route: string;
  traceId: string;
  citations: Citation[];
  toolResults: ToolResult[];
  latencyMs: number | null;
  answerMode: string | null;
};

export function Inspector({
  open,
  onClose,
  route,
  traceId,
  citations,
  toolResults,
  latencyMs,
  answerMode,
}: InspectorProps) {
  return (
    <aside className={`inspector ${open ? "open" : ""}`} aria-label="Retrieval trace">
      <div className="inspector-head">
        <div>
          <h2>Retrieval trace</h2>
          <p>What the assistant looked at for the last answer</p>
        </div>
        <button type="button" className="icon-button ghost" title="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <section className="panel">
        <h2>
          <Route size={16} />
          Trace
        </h2>
        <dl>
          <dt>Route</dt>
          <dd>{route}</dd>
          <dt>Latency</dt>
          <dd>{latencyMs === null ? "—" : `${(latencyMs / 1000).toFixed(2)} s`}</dd>
          <dt>Answer</dt>
          <dd>{ANSWER_MODES[answerMode || ""] || answerMode || "—"}</dd>
          <dt>Trace ID</dt>
          <dd className="mono">{traceId}</dd>
        </dl>
      </section>

      <section className="panel">
        <h2>
          <FileSearch size={16} />
          Retrieval
        </h2>
        <div className={citations.length ? "list" : "empty"}>
          {citations.length
            ? citations.map((citation) => (
                <div className="citation" key={citation.chunk_id}>
                  <strong>
                    [{citation.n}] {citation.source.split("/").pop()}
                    {citation.page ? ` · p. ${citation.page}` : ""}
                  </strong>
                  <div className="score-bar" aria-hidden>
                    <span style={{ width: `${Math.round((citation.score || 0) * 100)}%` }} />
                  </div>
                  <span>cosine similarity {formatScore(citation.score)}</span>
                </div>
              ))
            : "No sources used yet."}
        </div>
      </section>

      <section className="panel">
        <h2>
          <Braces size={16} />
          Tool Results
        </h2>
        <pre className="code">
          {toolResults.length ? JSON.stringify(toolResults, null, 2) : "No tool calls yet."}
        </pre>
      </section>
    </aside>
  );
}

const ANSWER_MODES: Record<string, string> = {
  llm: "LLM with citations",
  extractive: "extractive (no LLM key)",
  fallback: "extractive (LLM call failed)",
};

function formatScore(value: number | null): string {
  return typeof value === "number" ? value.toFixed(3) : "n/a";
}
