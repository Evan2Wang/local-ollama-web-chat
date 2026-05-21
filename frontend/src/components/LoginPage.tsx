import { FormEvent, useState } from "react";

type Props = {
  onLogin: (token: string) => Promise<void>;
};

export function LoginPage({ onLogin }: Props) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(token.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-panel" onSubmit={submit}>
        <h1>Local Ollama Web Chat</h1>
        <label>
          本地访问 Token
          <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="APP_TOKEN" autoFocus />
        </label>
        {error && <p className="login-error">{error}</p>}
        <button type="submit" disabled={busy || !token.trim()}>进入</button>
      </form>
    </main>
  );
}
