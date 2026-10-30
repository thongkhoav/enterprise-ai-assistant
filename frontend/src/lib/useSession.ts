import { useCallback, useEffect, useState } from "react";

import { fetchMe } from "../api/client";
import type { AuthUser, Settings } from "../types";
import { clearToken, getToken, setToken } from "./auth";

/** The signed-in user. A token the server rejects signs the user out. */
export function useSession(settings: Settings) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<AuthUser | null>(null);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const authenticate = useCallback((nextToken: string) => {
    setToken(nextToken);
    setTokenState(nextToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchMe(settings, token)
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) logout();
      });
    return () => {
      cancelled = true;
    };
  }, [settings, token, logout]);

  return { token, user, setUser, authenticate, logout };
}
