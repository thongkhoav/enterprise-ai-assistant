import { useCallback, useEffect, useState } from "react";

import { deleteDocument, listDocuments, uploadDocument } from "../api/client";
import type { DocumentSummary, Settings } from "../types";

export type UploadStatus = {
  text: string;
  type: "ok" | "warn" | "error";
};

export const ACCEPTED_FILES = ".pdf,.docx,.txt,.md";

/** The shared knowledge index: list, upload (sidebar, composer, drag and drop) and delete. */
export function useDocuments(settings: Settings, token: string | null) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setDocuments(await listDocuments(settings, token));
    } catch {
      // The list is informational; upload and chat still work without it.
    }
  }, [settings, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.type !== "ok") return;
    const timer = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const upload = useCallback(
    async (files: FileList | File[] | null) => {
      const picked = Array.from(files || []);
      if (!token || !picked.length) return;

      setIsUploading(true);
      for (const file of picked) {
        setStatus({ text: `Indexing ${file.name}...`, type: "warn" });
        try {
          const response = await uploadDocument(settings, token, file);
          const pages = response.page_count ? `${response.page_count} pages, ` : "";
          setStatus({
            text: `${response.source} indexed (${pages}${response.chunks_indexed} chunks).`,
            type: "ok",
          });
        } catch (error) {
          setStatus({
            text: `${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`,
            type: "error",
          });
        }
      }
      setIsUploading(false);
      await refresh();
    },
    [settings, token, refresh],
  );

  const remove = useCallback(
    async (documentId: string) => {
      if (!token) return;
      try {
        await deleteDocument(settings, token, documentId);
      } finally {
        await refresh();
      }
    },
    [settings, token, refresh],
  );

  return { documents, status, isUploading, upload, remove };
}
