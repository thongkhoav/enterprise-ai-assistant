export type Role = "user" | "assistant" | "agent" | "system";

export type UserRole = "admin" | "member";

export type ChatMessage = {
  id: string;
  /** The id the server saved it under; set once the answer is done. */
  serverId?: string;
  /** "agent" is a person from the support team replying in the conversation. */
  role: Exclude<Role, "system">;
  content: string;
  suggestions?: string[];
  route?: string;
  citations?: Citation[];
  latencyMs?: number;
  answerMode?: string;
  toolResults?: ToolResult[];
};

export type ApiChatMessage = {
  role: Role;
  content: string;
};

export type Citation = {
  n?: number | null;
  source: string;
  document_id?: string | null;
  chunk_id: string;
  score: number | null;
  page?: number | null;
  text?: string | null;
};

export type ToolResult = {
  name: string;
  result: Record<string, unknown>;
};

export type DoneEvent = {
  type: "done";
  conversation_id: string;
  citations: Citation[];
  tool_results: ToolResult[];
  trace_id: string;
  route: string;
  latency_ms?: number;
  answer_mode?: string;
  message_id?: string;
};

export type SuggestionsEvent = {
  type: "suggestions";
  questions: string[];
  message_id?: string;
};

export type ErrorEvent = {
  type: "error";
  detail: string;
};

export type TokenEvent = {
  type: "token";
  text: string;
};

export type StreamEvent = DoneEvent | TokenEvent | SuggestionsEvent | ErrorEvent;

export type Settings = {
  apiBaseUrl: string;
};

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  can_switch_role: boolean;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type ApiMessage = {
  id: string;
  role: Role;
  content: string;
  route?: string | null;
  trace_id?: string | null;
  citations: Citation[];
  tool_results: ToolResult[];
  suggestions?: string[];
  created_at: string;
};

export type ConversationDetail = ConversationSummary & {
  messages: ApiMessage[];
};

export type UploadResponse = {
  document_id: string;
  source: string;
  chunks_indexed: number;
  page_count?: number | null;
};

export type DocumentSummary = {
  document_id: string;
  source: string;
  filename?: string | null;
  page_count?: number | null;
  chunks: number;
};


export type SupportKind = "docs" | "human";

/** A member asking a person for help: a missing document, or a human reply. */
export type SupportRequest = {
  id: string;
  kind: SupportKind;
  status: "open" | "resolved";
  question: string;
  user_email: string;
  conversation_id?: string | null;
  message_id?: string | null;
  reply?: string | null;
  created_at: string;
  resolved_at?: string | null;
};

export type SupportChannel = {
  kind: string;
  label: string;
  href: string;
};
