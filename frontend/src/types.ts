export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: Exclude<Role, "system">;
  content: string;
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
};

export type ErrorEvent = {
  type: "error";
  detail: string;
};

export type TokenEvent = {
  type: "token";
  text: string;
};

export type StreamEvent = DoneEvent | TokenEvent | ErrorEvent;

export type Settings = {
  apiBaseUrl: string;
};

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
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

