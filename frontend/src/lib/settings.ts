import type { Settings } from "../types";

const STORAGE_KEY = "enterpriseAssistantSettings";

export function loadSettings(): Settings {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    return JSON.parse(saved) as Settings;
  }

  return {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
    apiKey: import.meta.env.VITE_API_KEY || "dev-secret",
    sessionId: "demo-session",
  };
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

