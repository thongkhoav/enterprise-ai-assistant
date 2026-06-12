import {
  Activity,
  Database,
  FileText,
  Save,
  TicketCheck,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";

import { checkHealth, uploadDocument } from "../api/client";
import type { Settings } from "../types";

type SidebarProps = {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onPrompt: (prompt: string) => void;
};

const PROMPTS = [
  {
    icon: FileText,
    text: "What is the refund SLA policy?",
  },
  {
    icon: Database,
    text: "What is current MRR revenue?",
  },
  {
    icon: TicketCheck,
    text: "Create a high priority ticket for a failed enterprise import.",
  },
];

export function Sidebar({ settings, onSettingsChange, onPrompt }: SidebarProps) {
  const [draft, setDraft] = useState(settings);
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<StatusState>({
    text: "Not checked.",
    type: "muted",
  });
  const [uploadStatus, setUploadStatus] = useState<StatusState>({
    text: "No document selected.",
    type: "muted",
  });

  async function handleHealthCheck() {
    setConnectionStatus({ text: "Checking...", type: "warn" });
    try {
      const status = await checkHealth(draft);
      setConnectionStatus({ text: `Backend: ${status}`, type: "ok" });
    } catch (error) {
      setConnectionStatus({
        text: error instanceof Error ? error.message : "Health check failed.",
        type: "error",
      });
    }
  }

  async function handleUpload() {
    if (!file) {
      setUploadStatus({ text: "Choose a document first.", type: "warn" });
      return;
    }

    setUploadStatus({ text: "Indexing...", type: "warn" });
    try {
      const response = await uploadDocument(draft, file, sourceLabel.trim());
      setUploadStatus({
        text: `${response.chunks_indexed} chunks indexed from ${response.source}.`,
        type: "ok",
      });
    } catch (error) {
      setUploadStatus({
        text: error instanceof Error ? error.message : "Upload failed.",
        type: "error",
      });
    }
  }

  return (
    <aside className="sidebar" aria-label="Settings">
      <div className="brand">
        <div className="brand-mark">AI</div>
        <div>
          <h1>Enterprise AI Assistant</h1>
          <p>Operator console</p>
        </div>
      </div>

      <section className="panel">
        <h2>Connection</h2>
        <label>
          API base URL
          <input
            value={draft.apiBaseUrl}
            onChange={(event) =>
              setDraft({ ...draft, apiBaseUrl: event.target.value.replace(/\/$/, "") })
            }
          />
        </label>
        <label>
          API key
          <input
            type="password"
            value={draft.apiKey}
            onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
          />
        </label>
        <label>
          Session
          <input
            value={draft.sessionId}
            onChange={(event) => setDraft({ ...draft, sessionId: event.target.value })}
          />
        </label>
        <div className="actions">
          <button type="button" onClick={() => onSettingsChange(draft)}>
            <Save size={17} />
            Save
          </button>
          <button type="button" className="secondary" onClick={handleHealthCheck}>
            <Activity size={17} />
            Health
          </button>
        </div>
        <Status state={connectionStatus} />
      </section>

      <section className="panel">
        <h2>Knowledge</h2>
        <label>
          Document
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        <label>
          Source label
          <input
            value={sourceLabel}
            placeholder="sample_policy.md"
            onChange={(event) => setSourceLabel(event.target.value)}
          />
        </label>
        <button type="button" onClick={handleUpload}>
          <UploadCloud size={17} />
          Upload
        </button>
        <Status state={uploadStatus} />
      </section>

      <section className="panel">
        <h2>Prompts</h2>
        {PROMPTS.map((prompt) => {
          const Icon = prompt.icon;
          return (
            <button
              className="prompt"
              key={prompt.text}
              type="button"
              onClick={() => onPrompt(prompt.text)}
            >
              <Icon size={17} />
              <span>{prompt.text}</span>
            </button>
          );
        })}
      </section>
    </aside>
  );
}

type StatusState = {
  text: string;
  type: "muted" | "ok" | "warn" | "error";
};

function Status({ state }: { state: StatusState }) {
  return <p className={`status ${state.type}`}>{state.text}</p>;
}

