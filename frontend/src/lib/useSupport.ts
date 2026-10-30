import { useCallback, useEffect, useRef, useState } from "react";

import {
  createSupportRequest,
  listSupportChannels,
  listSupportRequests,
  resolveSupportRequest,
} from "../api/client";
import type { Settings, SupportChannel, SupportKind, SupportRequest } from "../types";

const POLL_MS = 6000;

/**
 * Hand-offs to people. Members see their own requests, admins see the whole inbox. The list is
 * polled while anything is open, and `onResolved` fires when one of the member's requests gets
 * a reply, so the conversation it belongs to can be reloaded.
 *
 * `rememberKey` keeps the open request ids in sessionStorage. The widget reloads on every page
 * of the host site, and without it a reply that lands between two pages would go unnoticed.
 */
export function useSupport(
  settings: Settings,
  token: string | null,
  isAdmin: boolean,
  onResolved: (request: SupportRequest) => void,
  rememberKey?: string,
) {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [channels, setChannels] = useState<SupportChannel[]>([]);
  const openIds = useRef<Set<string>>(new Set());
  const resolvedRef = useRef(onResolved);
  resolvedRef.current = onResolved;

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const items = await listSupportRequests(settings, token);
      for (const item of items) {
        if (item.status === "resolved" && openIds.current.has(item.id)) resolvedRef.current(item);
      }
      openIds.current = new Set(items.filter((item) => item.status === "open").map((item) => item.id));
      remember(rememberKey, openIds.current);
      setRequests(items);
    } catch {
      // Hand-off state is secondary; chat keeps working without it.
    }
  }, [settings, token, rememberKey]);

  useEffect(() => {
    openIds.current = recall(rememberKey);
    setRequests([]);
    void refresh();
  }, [refresh, isAdmin]);

  useEffect(() => {
    if (!token) return;
    listSupportChannels(settings, token)
      .then(setChannels)
      .catch(() => setChannels([]));
  }, [settings, token]);

  const hasOpen = requests.some((item) => item.status === "open");
  useEffect(() => {
    // Admins watch for new requests; members only while they wait for a reply.
    if (!token || (!isAdmin && !hasOpen)) return;
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [token, isAdmin, hasOpen, refresh]);

  const create = useCallback(
    async (kind: SupportKind, question: string, conversationId: string | null, messageId?: string) => {
      if (!token) return;
      const request = await createSupportRequest(settings, token, {
        kind,
        question,
        conversation_id: conversationId,
        message_id: messageId,
      });
      openIds.current.add(request.id);
      remember(rememberKey, openIds.current);
      setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    },
    [settings, token, rememberKey],
  );

  const resolve = useCallback(
    async (requestId: string, reply: string) => {
      if (!token) return;
      const request = await resolveSupportRequest(settings, token, requestId, reply);
      openIds.current.delete(request.id);
      remember(rememberKey, openIds.current);
      setRequests((current) => current.map((item) => (item.id === request.id ? request : item)));
      // On the demo the admin may be replying in their own conversation.
      resolvedRef.current(request);
    },
    [settings, token, rememberKey],
  );

  return { requests, channels, create, resolve, refresh };
}

function recall(key: string | undefined): Set<string> {
  if (!key) return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(key) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function remember(key: string | undefined, ids: Set<string>): void {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    // Storage blocked: replies are still noticed while the page stays open.
  }
}
