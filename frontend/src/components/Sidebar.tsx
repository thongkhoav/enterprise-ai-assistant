import {
  FileText,
  LogOut,
  MessageSquare,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useState } from "react";

import { APP_NAME } from "../lib/brand";
import { ACCEPTED_FILES, type UploadStatus } from "../lib/useDocuments";
import type { AuthUser, ConversationSummary, DocumentSummary } from "../types";

type SidebarProps = {
  open: boolean;
  user: AuthUser | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  documents: DocumentSummary[];
  uploadStatus: UploadStatus | null;
  isUploading: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpload: (files: FileList | null) => void;
  onDeleteDocument: (id: string) => void;
  onLogout: () => void;
};

type Tab = "chats" | "docs";

export function Sidebar({
  open,
  user,
  conversations,
  activeConversationId,
  documents,
  uploadStatus,
  isUploading,
  onClose,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onUpload,
  onDeleteDocument,
  onLogout,
}: SidebarProps) {
  const [tab, setTab] = useState<Tab>("chats");
  const totalChunks = documents.reduce((sum, item) => sum + item.chunks, 0);
  const isGuest = user?.email.startsWith("guest-");

  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navigation">
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-mark">
            <FileText size={18} />
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>RAG assistant with sources</p>
          </div>
          <button type="button" className="icon-button close-sidebar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <button type="button" className="new-chat" onClick={onNewChat}>
          <Plus size={18} />
          New chat
        </button>

        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chats"}
            className={tab === "chats" ? "active" : ""}
            onClick={() => setTab("chats")}
          >
            Chats
            <span>{conversations.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "docs"}
            className={tab === "docs" ? "active" : ""}
            onClick={() => setTab("docs")}
          >
            Documents
            <span>{documents.length}</span>
          </button>
        </div>
      </div>

      <div className="sidebar-body">
        {tab === "chats" ? (
          conversations.length ? (
            <div className="conversation-list">
              {conversations.map((conversation) => (
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
                    <MessageSquare size={15} />
                    <span>{conversation.title}</span>
                    <time>{relativeTime(conversation.updated_at)}</time>
                  </button>
                  <button
                    type="button"
                    className="icon-button ghost"
                    title="Delete conversation"
                    onClick={() => onDeleteConversation(conversation.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Your conversations will show up here.</p>
          )
        ) : (
          <div className="knowledge">
            <label className={`dropzone ${isUploading ? "busy" : ""}`}>
              <UploadCloud size={22} />
              <strong>{isUploading ? "Indexing..." : "Upload documents"}</strong>
              <span>PDF, DOCX, Markdown or text</span>
              <input
                type="file"
                multiple
                accept={ACCEPTED_FILES}
                onChange={(event) => {
                  onUpload(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
            {uploadStatus && <p className={`status ${uploadStatus.type}`}>{uploadStatus.text}</p>}
            <p className="count">
              {documents.length} documents · {totalChunks} chunks indexed
            </p>
            <div className="document-list">
              {documents.map((document) => (
                <div className="document-item" key={document.document_id}>
                  <span className={`file-badge ${fileKind(document.source)}`}>
                    {fileKind(document.source)}
                  </span>
                  <div>
                    <strong title={document.source}>{document.source.split("/").pop()}</strong>
                    <span>
                      {document.page_count ? `${document.page_count} pages · ` : ""}
                      {document.chunks} chunks
                    </span>
                  </div>
                  <button
                    type="button"
                    className="icon-button ghost"
                    title="Remove from index"
                    onClick={() => onDeleteDocument(document.document_id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="user-avatar">{isGuest ? "G" : (user?.email[0] || "?").toUpperCase()}</div>
        <div className="user-meta">
          <strong>{isGuest ? "Guest" : user?.full_name || user?.email || ""}</strong>
          <span>{isGuest ? "Demo session" : user?.email}</span>
        </div>
        <button type="button" className="icon-button ghost" title="Sign out" onClick={onLogout}>
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

function fileKind(source: string): string {
  const extension = source.split(".").pop()?.toLowerCase() || "";
  return ["pdf", "docx", "md", "txt"].includes(extension) ? extension : "file";
}

function relativeTime(value: string): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
