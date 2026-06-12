import type { ApiChatMessage, Settings, StreamEvent, UploadResponse } from "../types";

export async function checkHealth(settings: Settings): Promise<string> {
  const response = await fetch(`${settings.apiBaseUrl}/health`);
  const payload = await readJson<{ status?: string; detail?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.detail || "Health check failed");
  }
  return payload.status || "unknown";
}

export async function uploadDocument(
  settings: Settings,
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
    headers: authHeaders(settings),
    body: form,
  });
  const payload = await readJson<UploadResponse & { detail?: string }>(response);
  if (!response.ok) {
    throw new Error(payload.detail || "Upload failed");
  }
  return payload;
}

export async function streamChat(
  settings: Settings,
  message: string,
  history: ApiChatMessage[],
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${settings.apiBaseUrl}/v1/chat/stream`, {
    method: "POST",
    headers: {
      ...authHeaders(settings),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: settings.sessionId,
      message,
      history,
    }),
  });

  if (!response.ok || !response.body) {
    const payload = await readJson<{ detail?: string }>(response);
    throw new Error(payload.detail || "Chat request failed");
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
      onEvent(JSON.parse(dataLine.slice(6)) as StreamEvent);
    }
  }
}

function authHeaders(settings: Settings): HeadersInit {
  return {
    Authorization: `Bearer ${settings.apiKey}`,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

