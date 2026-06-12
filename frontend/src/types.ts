export type Role = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: Exclude<Role, "system">;
  content: string;
};

export type ApiChatMessage = {
  role: Role;
  content: string;
};

export type Citation = {
  source: string;
  chunk_id: string;
  score: number | null;
  page?: number | null;
};

export type ToolResult = {
  name: string;
  result: Record<string, unknown>;
};

export type DoneEvent = {
  type: "done";
  citations: Citation[];
  tool_results: ToolResult[];
  trace_id: string;
  route: string;
};

export type TokenEvent = {
  type: "token";
  text: string;
};

export type StreamEvent = DoneEvent | TokenEvent;

export type Settings = {
  apiBaseUrl: string;
  apiKey: string;
  sessionId: string;
};

export type UploadResponse = {
  document_id: string;
  source: string;
  chunks_indexed: number;
};

