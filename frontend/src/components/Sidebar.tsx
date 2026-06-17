import {
  Database,
  FileText,
  LogOut,
  MessageSquarePlus,
  TicketCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useState } from "react";

import { uploadDocument } from "../api/client";
import type { AuthUser, ConversationSummary, Settings } from "../types";

type SidebarProps = {
  settings: Settings;
  token: string;
  user: AuthUser | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onPrompt: (prompt: string) => void;
  onLogout: () => void;
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

export function Sidebar({
  settings,
  token,
  user,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onPrompt,
  onLogout,
}: SidebarProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sourceLabel, setSourceLabel] = useState("");
  const [uploadStatus, setUploadStatus] = useState<StatusState>({
    text: "No document selected.",
    type: "muted",
  });

  async function handleUpload() {
    if (!file) {
      setUploadStatus({ text: "Choose a document first.", type: "warn" });
      return;
    }

    setUploadStatus({ text: "Indexing...", type: "warn" });
    try {
      const response = await uploadDocument(settings, token, file, sourceLabel.trim());
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
    <aside className="sidebar" aria-label="Navigation">
      <div className="brand">
        <div className="brand-mark">AI</div>
        <div>
          <h1>Enterprise AI Assistant</h1>
          <p>{user?.email || "Operator console"}</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Conversations</h2>
          <button type="button" className="icon-button" onClick={onNewChat} title="New chat">
            <MessageSquarePlus size={17} />
          </button>
        </div>
        <div className={conversations.length ? "conversation-list" : "empty"}>
          {conversations.length
            ? conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`conversation-item ${
                    conversation.id === activeConversationId ? "active" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="conversation-title"
                    onClick={() => onSelectConversation(conversation.id)}
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    className="icon-button danger"
                    title="Delete conversation"
                    onClick={() => onDeleteConversation(conversation.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            : "No conversations yet."}
        </div>
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

      <button type="button" className="secondary logout" onClick={onLogout}>
        <LogOut size={17} />
        Sign out
      </button>
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
