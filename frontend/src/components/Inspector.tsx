import { Braces, FileSearch, Route } from "lucide-react";

import type { Citation, ToolResult } from "../types";

type InspectorProps = {
  route: string;
  traceId: string;
  citations: Citation[];
  toolResults: ToolResult[];
};

export function Inspector({ route, traceId, citations, toolResults }: InspectorProps) {
  return (
    <aside className="inspector" aria-label="Inspector">
      <section className="panel">
        <h2>
          <Route size={16} />
          Trace
        </h2>
        <dl>
          <dt>Trace ID</dt>
          <dd>{traceId}</dd>
          <dt>Route</dt>
          <dd>{route}</dd>
        </dl>
      </section>

      <section className="panel">
        <h2>
          <FileSearch size={16} />
          Citations
        </h2>
        <div className={citations.length ? "list" : "empty"}>
          {citations.length
            ? citations.map((citation) => (
                <div className="citation" key={`${citation.source}-${citation.chunk_id}`}>
                  <strong>{citation.source}</strong>
                  <span>
                    {citation.chunk_id} · score {formatScore(citation.score)}
                  </span>
                </div>
              ))
            : "No citations yet."}
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

function formatScore(value: number | null): string {
  return typeof value === "number" ? value.toFixed(3) : "n/a";
}

