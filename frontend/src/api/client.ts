import type {
  AuthUser,
  ConversationDetail,
  ConversationSummary,
  DocumentSummary,
  ErrorEvent,
  Settings,
  StreamEvent,
  SupportChannel,
  SupportKind,
  SupportRequest,
  UploadResponse,
  UserRole,
} from "../types";

export async function checkHealth(settings: Settings): Promise<string> {
  const response = await fetch(`${settings.apiBaseUrl}/health`);
  const payload = await readJson<{ status?: string; detail?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.detail || "Health check failed");
  }
  return payload.status || "unknown";
}

export async function registerUser(
  settings: Settings,
  email: string,
  password: string,
  fullName?: string,
): Promise<string> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName || null }),
  });
  const payload = await readJson<{ access_token?: string; detail?: string }>(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(detailMessage(payload.detail) || "Registration failed");
  }
  return payload.access_token;
}

export async function loginUser(
  settings: Settings,
  email: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await readJson<{ access_token?: string; detail?: string }>(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(detailMessage(payload.detail) || "Login failed");
  }
  return payload.access_token;
}

export async function fetchMe(settings: Settings, token: string): Promise<AuthUser> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/auth/me`, {
    headers: authHeaders(token),
  });
  const payload = await readJson<AuthUser & { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload.detail) || "Failed to load profile");
  }
  return payload;
}

/** Public demo only: switch the signed-in user between member and admin. */
export async function switchRole(
  settings: Settings,
  token: string,
  role: UserRole,
): Promise<AuthUser> {
  return sendJson<AuthUser>(settings, token, "PUT", "/v1/auth/me/role", { role });
}

export async function listSupportChannels(
  settings: Settings,
  token: string,
): Promise<SupportChannel[]> {
  return sendJson<SupportChannel[]>(settings, token, "GET", "/v1/support/channels");
}

/** Admins get every request (their inbox); members get their own. */
export async function listSupportRequests(
  settings: Settings,
  token: string,
): Promise<SupportRequest[]> {
  return sendJson<SupportRequest[]>(settings, token, "GET", "/v1/support/requests");
}

export async function createSupportRequest(
  settings: Settings,
  token: string,
  request: {
    kind: SupportKind;
    question: string;
    conversation_id?: string | null;
    message_id?: string | null;
  },
): Promise<SupportRequest> {
  return sendJson<SupportRequest>(settings, token, "POST", "/v1/support/requests", request);
}

export async function resolveSupportRequest(
  settings: Settings,
  token: string,
  requestId: string,
  reply: string,
): Promise<SupportRequest> {
  return sendJson<SupportRequest>(
    settings,
    token,
    "POST",
    `/v1/support/requests/${requestId}/resolve`,
    { reply },
  );
}

export async function listConversations(
  settings: Settings,
  token: string,
): Promise<ConversationSummary[]> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/conversations`, {
    headers: authHeaders(token),
  });
  const payload = await readJson<ConversationSummary[] | { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(
      detailMessage((payload as { detail?: string }).detail) || "Failed to load conversations",
    );
  }
  return payload as ConversationSummary[];
}

export async function getConversation(
  settings: Settings,
  token: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/conversations/${conversationId}`, {
    headers: authHeaders(token),
  });
  const payload = await readJson<ConversationDetail & { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload.detail) || "Failed to load conversation");
  }
  return payload;
}

export async function deleteConversation(
  settings: Settings,
  token: string,
  conversationId: string,
): Promise<void> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/conversations/${conversationId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    const payload = await readJson<{ detail?: string }>(response);
    throw new Error(detailMessage(payload.detail) || "Failed to delete conversation");
  }
}

export async function listDocuments(
  settings: Settings,
  token: string,
): Promise<DocumentSummary[]> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/documents`, {
    headers: authHeaders(token),
  });
  const payload = await readJson<DocumentSummary[] | { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(
      detailMessage((payload as { detail?: string }).detail) || "Failed to load documents",
    );
  }
  return payload as DocumentSummary[];
}

export async function deleteDocument(
  settings: Settings,
  token: string,
  documentId: string,
): Promise<void> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/documents/${documentId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!response.ok && response.status !== 204) {
    const payload = await readJson<{ detail?: string }>(response);
    throw new Error(detailMessage(payload.detail) || "Failed to delete document");
  }
}

export async function uploadDocument(
  settings: Settings,
  token: string,
  file: File,
  sourceLabel?: string,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  if (sourceLabel) {
    form.append("source", sourceLabel);
  }

  const response = await fetch(`${settings.apiBaseUrl}/v1/documents/upload`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
  const payload = await readJson<UploadResponse & { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload.detail) || "Upload failed");
  }
  return payload;
}

export async function streamChat(
  settings: Settings,
  token: string,
  conversationId: string | null,
  message: string,
  onEvent: (event: Exclude<StreamEvent, ErrorEvent>) => void,
): Promise<void> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/chat/stream`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      message,
    }),
  });

  if (!response.ok || !response.body) {
    const payload = await readJson<{ detail?: string }>(response);
    throw new Error(detailMessage(payload.detail) || "Chat request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const eventTexts = buffer.split("\n\n");
    buffer = eventTexts.pop() || "";

    for (const eventText of eventTexts) {
      const dataLine = eventText.split("\n").find((line) => line.startsWith("data: "));
      if (!dataLine) continue;
      const event = JSON.parse(dataLine.slice(6)) as StreamEvent;
      if (event.type === "error") {
        throw new Error(event.detail || "The model request failed.");
      }
      onEvent(event);
    }
  }
}

async function sendJson<T>(
  settings: Settings,
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${settings.apiBaseUrl}${path}`, {
    method,
    headers: {
      ...authHeaders(token),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readJson<T & { detail?: unknown }>(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload.detail) || `Request failed (${response.status})`);
  }
  return payload;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function detailMessage(detail: unknown): string | undefined {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    return first.msg;
  }
  return undefined;
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}
