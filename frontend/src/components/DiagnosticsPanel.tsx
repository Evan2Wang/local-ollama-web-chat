import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchChatHealth, fetchHealthConfig, fetchOllamaHealth } from "../api/client";
import type { HealthConfig, OllamaHealth } from "../types/chat";

function Result({ title, result }: { title: string; result: OllamaHealth | null }) {
  return (
    <section className="diagnostic-result">
      <h2>{title}</h2>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : <p>等待测试。</p>}
    </section>
  );
}

export function DiagnosticsPanel({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<HealthConfig | null>(null);
  const [ollama, setOllama] = useState<OllamaHealth | null>(null);
  const [chat, setChat] = useState<OllamaHealth | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [nextConfig, nextOllama, nextChat] = await Promise.all([fetchHealthConfig(), fetchOllamaHealth(), fetchChatHealth()]);
      setConfig(nextConfig);
      setOllama(nextOllama);
      setChat(nextChat);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <main className="diagnostics-page">
      <header>
        <div>
          <h1>Ollama 诊断</h1>
          <p>{ollama?.ok ? "Ollama 在线" : "检查后端与 Ollama 的本地连接"}</p>
        </div>
        <div className="diagnostic-actions">
          <button className="subtle-button" type="button" onClick={onBack}>返回聊天</button>
          <button className="subtle-button" type="button" onClick={refresh} disabled={busy}><RefreshCw size={16} /> 重新测试</button>
        </div>
      </header>
      {error && <div className="error-banner">{error}</div>}
      {config && (
        <dl className="config-grid">
          <dt>OLLAMA_BASE_URL</dt><dd>{config.ollama_base_url}</dd>
          <dt>DEFAULT_MODEL</dt><dd>{config.default_model}</dd>
          <dt>OLLAMA_THINK</dt><dd>{String(config.ollama_think)}</dd>
          <dt>MAX_FILE_CHARS</dt><dd>{config.max_file_chars}</dd>
          <dt>AUTH_ENABLED</dt><dd>{String(config.auth_enabled)}</dd>
          <dt>本地模型</dt><dd>{ollama?.models?.map((model) => model.name).join("，") || "-"}</dd>
        </dl>
      )}
      <Result title="/api/tags 测试结果" result={ollama} />
      <Result title="/api/chat 测试结果" result={chat} />
    </main>
  );
}
