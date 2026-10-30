import { CircleHelp, FileText, LogIn, Quote, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";

import { loginUser, registerUser } from "../api/client";
import { APP_NAME, APP_SUBTITLE, APP_TAGLINE, GUEST_ACCESS } from "../lib/brand";
import type { Settings } from "../types";

type AuthScreenProps = {
  settings: Settings;
  onAuthenticated: (token: string) => void;
};

type Mode = "login" | "register";

const FEATURES = [
  { icon: Quote, text: "Every answer links to the passage and page it came from" },
  {
    icon: CircleHelp,
    text: "Says “I don't know”, then lets you request the document or ask a person",
  },
  { icon: ShieldCheck, text: "Admins curate the PDFs, Word files and wikis; everyone else asks" },
];

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

  async function handleGuest() {
    setError(null);
    setIsBusy(true);
    try {
      // A throwaway account per visitor, so guest conversations stay private to that browser.
      const id = crypto.randomUUID();
      const token = await registerUser(settings, `guest-${id.slice(0, 12)}@example.com`, id);
      onAuthenticated(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in as a guest.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <div className="brand">
          <div className="brand-mark">
            <FileText size={18} />
          </div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>{APP_SUBTITLE}</p>
          </div>
        </div>
        <h2>{APP_TAGLINE}.</h2>
        <ul>
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text}>
              <span>
                <Icon size={17} />
              </span>
              {text}
            </li>
          ))}
        </ul>
        <div className="hero-preview" aria-hidden>
          <p>
            Full-time employees get 20 days of paid time off per year
            <span className="cite">1</span>, and up to 5 unused days carry over to the next year
            <span className="cite">1</span>.
          </p>
          <div>
            <span className="source-n">1</span> acme_employee_handbook.pdf · p. 2
            <span className="source-score">85%</span>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <h3>{mode === "login" ? "Sign in" : "Create your account"}</h3>
          <p className="muted">Use your work email.</p>

          <form onSubmit={handleSubmit}>
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
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : undefined}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error && <p className="status error">{error}</p>}

            <button type="submit" className="primary-lg" disabled={isBusy}>
              {mode === "login" ? <LogIn size={17} /> : <UserPlus size={17} />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          {GUEST_ACCESS && (
            <>
              <div className="divider">or</div>
              <button type="button" className="secondary" disabled={isBusy} onClick={handleGuest}>
                <Sparkles size={17} />
                {isBusy ? "Signing in..." : "Continue as guest"}
              </button>
            </>
          )}

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
        </div>
      </section>
    </main>
  );
}
