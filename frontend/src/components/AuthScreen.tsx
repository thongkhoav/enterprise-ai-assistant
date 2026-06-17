import { LogIn, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

import { loginUser, registerUser } from "../api/client";
import type { Settings } from "../types";

type AuthScreenProps = {
  settings: Settings;
  onAuthenticated: (token: string) => void;
};

type Mode = "login" | "register";

export function AuthScreen({ settings, onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const token =
        mode === "login"
          ? await loginUser(settings, email.trim(), password)
          : await registerUser(settings, email.trim(), password, fullName.trim() || undefined);
      onAuthenticated(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <h1>Enterprise AI Assistant</h1>
            <p>{mode === "login" ? "Sign in to continue" : "Create your account"}</p>
          </div>
        </div>

        {mode === "register" && (
          <label>
            Full name (optional)
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Password
          <input
            type="password"
            required
            minLength={mode === "register" ? 8 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && <p className="status error">{error}</p>}

        <button type="submit" disabled={isBusy}>
          {mode === "login" ? <LogIn size={17} /> : <UserPlus size={17} />}
          {isBusy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <p className="auth-switch">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </form>
    </main>
  );
}
