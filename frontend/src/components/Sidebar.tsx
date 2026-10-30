import {
  FilePlus2,
  FileText,
  Inbox,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UploadCloud,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useState } from "react";

import { APP_NAME, APP_SUBTITLE } from "../lib/brand";
import { ACCEPTED_FILES, type UploadStatus } from "../lib/useDocuments";
import type {
  AuthUser,
  ConversationSummary,
  DocumentSummary,
  SupportRequest,
  UserRole,
} from "../types";

type SidebarProps = {
  open: boolean;
  user: AuthUser | null;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  /** Admins curate the documents and answer the inbox; members only read the list. */
  isAdmin: boolean;
  documents: DocumentSummary[];
  uploadStatus: UploadStatus | null;
  isUploading: boolean;
  requests: SupportRequest[];
  onResolveRequest: (requestId: string, reply: string) => Promise<void>;
  onSwitchRole: (role: UserRole) => void;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onUpload: (files: FileList | null) => void;
  onDeleteDocument: (id: string) => void;
  onLogout: () => void;
};

type Tab = "chats" | "docs" | "inbox";

export function Sidebar({
  open,
  user,
  conversations,
  activeConversationId,
  isAdmin,
  documents,
  uploadStatus,
  isUploading,
  requests,
  onResolveRequest,
  onSwitchRole,
  onClose,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onUpload,
  onDeleteDocument,
  onLogout,
}: SidebarProps) {
  const [tab, setTab] = useState<Tab>("chats");
  const isGuest = user?.email.startsWith("guest-");
  const openRequests = requests.filter((request) => request.status === "open");
  const resolvedCount = requests.length - openRequests.length;
  const activeTab = tab === "inbox" && !isAdmin ? "chats" : tab;

  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Navigation">
      <div className="sidebar-top">
        <div className="brand">
          <div className="brand-mark">
            <FileText size={18} />
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>{APP_SUBTITLE}</p>
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
            aria-selected={activeTab === "chats"}
            className={activeTab === "chats" ? "active" : ""}
            onClick={() => setTab("chats")}
          >
            Chats
            <span>{conversations.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "docs"}
            className={activeTab === "docs" ? "active" : ""}
            onClick={() => setTab("docs")}
          >
            Docs
            <span>{documents.length}</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "inbox"}
              className={`${activeTab === "inbox" ? "active" : ""} ${openRequests.length ? "alert" : ""}`}
              onClick={() => setTab("inbox")}
            >
              Inbox
              <span>{openRequests.length}</span>
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-body">
        {activeTab === "inbox" ? (
          <div className="inbox">
            {openRequests.length ? (
              openRequests.map((request) => (
                <InboxItem key={request.id} request={request} onResolve={onResolveRequest} />
              ))
            ) : (
              <div className="inbox-empty">
                <Inbox size={22} />
                <strong>No open requests</strong>
                <span>
                  When the assistant can't help, employees can request a document or ask for a
                  person. Their requests land here.
                </span>
              </div>
            )}
            {resolvedCount > 0 && <p className="count">{resolvedCount} resolved</p>}
          </div>
        ) : activeTab === "chats" ? (
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
            {isAdmin ? (
              <label className={`dropzone ${isUploading ? "busy" : ""}`}>
                <UploadCloud size={22} />
                <strong>{isUploading ? "Indexing..." : "Add documents"}</strong>
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
            ) : (
              <p className="managed-note">
                <ShieldCheck size={15} />
                Curated by your knowledge admins. Missing something? Ask, then request it from the
                answer.
              </p>
            )}
            {uploadStatus && <p className={`status ${uploadStatus.type}`}>{uploadStatus.text}</p>}
            <p className="count">
              {documents.length} documents
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
                      {fileLabel(document.source)}
                      {document.page_count ? ` · ${document.page_count} pages` : ""}
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="icon-button ghost"
                      title="Remove from index"
                      onClick={() => onDeleteDocument(document.document_id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {user?.can_switch_role && (
        <div className="role-switch" role="radiogroup" aria-label="View as">
          <span>View as</span>
          {(["member", "admin"] as const).map((role) => (
            <button
              type="button"
              role="radio"
              key={role}
              aria-checked={user.role === role}
              className={user.role === role ? "active" : ""}
              onClick={() => user.role !== role && onSwitchRole(role)}
            >
              {role === "member" ? <UserRound size={14} /> : <ShieldCheck size={14} />}
              {role === "member" ? "Employee" : "Admin"}
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <div className="user-avatar">{isGuest ? "G" : (user?.email[0] || "?").toUpperCase()}</div>
        <div className="user-meta">
          <strong>{isGuest ? "Guest" : user?.full_name || user?.email || ""}</strong>
          <span>
            {isAdmin ? "Knowledge admin" : "Employee"}
            {isGuest ? "" : ` · ${user?.email || ""}`}
          </span>
        </div>
        <button type="button" className="icon-button ghost" title="Sign out" onClick={onLogout}>
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

/** One open request in the admin inbox, answered with a reply posted back into the chat. */
function InboxItem({
  request,
  onResolve,
}: {
  request: SupportRequest;
  onResolve: (requestId: string, reply: string) => Promise<void>;
}) {
  const [reply, setReply] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docs = request.kind === "docs";
  const who = request.user_email.startsWith("guest-") ? "Guest" : request.user_email;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reply.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await onResolve(request.id, reply.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send the reply.");
      setIsSending(false);
    }
  }

  return (
    <form className="inbox-item" onSubmit={handleSubmit}>
      <span className={`inbox-kind ${docs ? "docs" : "human"}`}>
        {docs ? <FilePlus2 size={12} /> : <UserRound size={12} />}
        {docs ? "Missing document" : "Wants a person"}
      </span>
      <strong>{request.question}</strong>
      <span className="inbox-meta">
        {who} · {ago(request.created_at)}
      </span>
      {docs && <span className="inbox-hint">Add the document under Docs, then let them know.</span>}
      <textarea
        rows={2}
        value={reply}
        placeholder={docs ? "e.g. Added the policy, ask again." : "Reply in their chat..."}
        onChange={(event) => setReply(event.target.value)}
      />
      {error && <p className="status error">{error}</p>}
      <button type="submit" className="secondary" disabled={isSending || !reply.trim()}>
        {isSending ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}
        Reply and resolve
      </button>
    </form>
  );
}

const FILE_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  md: "Markdown",
  txt: "Text",
};

function fileLabel(source: string): string {
  return FILE_LABELS[fileKind(source)] || "File";
}

function fileKind(source: string): string {
  const extension = source.split(".").pop()?.toLowerCase() || "";
  return ["pdf", "docx", "md", "txt"].includes(extension) ? extension : "file";
}

function ago(value: string): string {
  const time = relativeTime(value);
  return time === "now" ? "just now" : `${time} ago`;
}

function relativeTime(value: string): string {
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
