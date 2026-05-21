import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import {
  createConversation,
  createPromptTemplate,
  deletePromptTemplate,
  fetchAttachment,
  fetchHealthConfig,
  fetchPromptTemplates,
  deleteConversation,
  checkToken,
  clearToken,
  fetchConversation,
  fetchConversations,
  fetchModels,
  reparseAttachment,
  saveToken,
  searchConversations,
  storedToken,
  streamChat,
  updatePromptTemplate,
  uploadAttachments
} from "../api/client";
import { AttachmentDetailPanel } from "../components/AttachmentDetailPanel";
import { ChatWindow } from "../components/ChatWindow";
import { Composer } from "../components/Composer";
import { DiagnosticsPanel } from "../components/DiagnosticsPanel";
import { LoginPage } from "../components/LoginPage";
import { ModelSelector } from "../components/ModelSelector";
import { PromptTemplateBar } from "../components/PromptTemplateBar";
import { Sidebar } from "../components/Sidebar";
import type { Attachment, AttachmentDetail, Conversation, ConversationSearchResult, Message, OllamaModel, PromptTemplate } from "../types/chat";

const imageTypes = ["image/png", "image/jpeg", "image/webp"];

function makeLocalMessage(role: "user" | "assistant", content: string, conversationId: string, attachments: Attachment[] = []): Message {
  return {
    id: `local_${role}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    conversation_id: conversationId,
    role,
    content,
    created_at: new Date().toISOString(),
    attachments
  };
}

export function Home() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [attachmentDetail, setAttachmentDetail] = useState<AttachmentDetail | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [view, setView] = useState<"chat" | "diagnostics">("chat");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId), [activeId, conversations]);

  const refreshConversations = useCallback(async () => {
    const list = await fetchConversations();
    setConversations(list);
    return list;
  }, []);

  const ensureConversation = useCallback(async () => {
    if (activeId) return activeId;
    const created = await createConversation(selectedModel);
    setActiveId(created.id);
    setConversations((items) => [created, ...items]);
    return created.id;
  }, [activeId, selectedModel]);

  const loadConversation = useCallback(async (id: string) => {
    const detail = await fetchConversation(id);
    setActiveId(detail.id);
    setSelectedModel(detail.model);
    setMessages(detail.messages);
    setPendingAttachments([]);
  }, []);

  const handleNew = useCallback(async () => {
    const created = await createConversation(selectedModel);
    setConversations((items) => [created, ...items]);
    setActiveId(created.id);
    setMessages([]);
    setPendingAttachments([]);
  }, [selectedModel]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setError("");
      try {
        const conversationId = await ensureConversation();
        const uploaded = await uploadAttachments(conversationId, files);
        setPendingAttachments((items) => [...items, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [ensureConversation]
  );

  const handleSend = useCallback(
    async (content: string) => {
      if (busy) return;
      setError("");
      setBusy(true);
      try {
        const conversationId = await ensureConversation();
        const currentAttachments = pendingAttachments;
        setPendingAttachments([]);
        const userMessage = makeLocalMessage("user", content, conversationId, currentAttachments);
        const assistantMessage = makeLocalMessage("assistant", "", conversationId);
        setMessages((items) => [...items, userMessage, assistantMessage]);
        await streamChat(
          {
            conversation_id: conversationId,
            model: selectedModel,
            content,
            attachment_ids: currentAttachments.map((item) => item.id)
          },
          (chunk) => {
            setMessages((items) =>
              items.map((item) => (item.id === assistantMessage.id ? { ...item, content: item.content + chunk } : item))
            );
          }
        );
        await refreshConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [busy, ensureConversation, pendingAttachments, refreshConversations, selectedModel]
  );

  useEffect(() => {
    async function verifyAuth() {
      try {
        const config = await fetchHealthConfig();
        if (!config.auth_enabled) {
          setAuthorized(true);
          return;
        }
        const token = storedToken();
        if (!token) {
          setAuthorized(false);
          return;
        }
        await checkToken(token);
        setAuthorized(true);
      } catch {
        clearToken();
        setAuthorized(false);
      }
    }
    verifyAuth();
  }, []);

  useEffect(() => {
    if (!authorized) return;
    async function boot() {
      try {
        const modelData = await fetchModels();
        setModels(modelData.models);
        setSelectedModel(modelData.default_model || modelData.models[0]?.name || "");
        setTemplates(await fetchPromptTemplates());
        const list = await refreshConversations();
        if (list[0]) await loadConversation(list[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    boot();
  }, [authorized, loadConversation, refreshConversations]);

  useEffect(() => {
    if (!authorized || !searchValue.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearchResults(await searchConversations(searchValue));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [authorized, searchValue]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files: File[] = [];
      for (const item of Array.from(event.clipboardData?.items || [])) {
        const file = item.getAsFile();
        if (file) {
          const fallbackName = imageTypes.includes(file.type) ? `clipboard-${Date.now()}.png` : file.name;
          files.push(new File([file], file.name || fallbackName, { type: file.type }));
        }
      }
      if (files.length) {
        event.preventDefault();
        handleFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFiles]);

  useEffect(() => {
    function onDragOver(event: DragEvent) {
      event.preventDefault();
      setDragging(true);
    }
    function onDragLeave(event: DragEvent) {
      if (event.target === document.body || event.target === document.documentElement) setDragging(false);
    }
    function onDrop(event: DragEvent) {
      event.preventDefault();
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files || []);
      if (files.length) handleFiles(files);
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  const openAttachment = useCallback(async (id: string) => {
    setError("");
    try {
      setAttachmentDetail(await fetchAttachment(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  async function login(token: string) {
    await checkToken(token);
    saveToken(token);
    setAuthorized(true);
  }

  async function refreshTemplates() {
    setTemplates(await fetchPromptTemplates());
  }

  if (authorized === null) return <div className="boot-screen">正在读取本地配置...</div>;
  if (!authorized) return <LoginPage onLogin={login} />;

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        searchValue={searchValue}
        searchResults={searchResults}
        onNew={handleNew}
        onSearch={setSearchValue}
        onSelect={loadConversation}
        onDiagnostics={() => setView("diagnostics")}
        onDelete={async (id) => {
          await deleteConversation(id);
          const next = await refreshConversations();
          if (id === activeId) {
            if (next[0]) await loadConversation(next[0].id);
            else {
              setActiveId(null);
              setMessages([]);
            }
          }
        }}
      />
      <section className="main-panel">
        {view === "diagnostics" ? (
          <DiagnosticsPanel onBack={() => setView("chat")} />
        ) : (
          <>
            <header className="topbar">
              <div>
                <strong>{activeConversation?.title || "新会话"}</strong>
                <span>本地单用户 · SQLite 历史</span>
              </div>
              <div className="topbar-tools">
                <button className="subtle-button" type="button" onClick={() => setView("diagnostics")} title="Ollama 诊断">
                  <Activity size={16} /> 诊断
                </button>
                <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} />
              </div>
            </header>
            {error && <div className="error-banner">{error}</div>}
            <ChatWindow messages={messages} streaming={busy} onOpenAttachment={openAttachment} />
            <footer className="composer-stack">
              <PromptTemplateBar
                templates={templates}
                onInsert={(content) => setComposerValue((value) => value ? `${value}\n\n${content}` : content)}
                onCreate={async (draft) => {
                  await createPromptTemplate({ ...draft, sort_order: templates.length + 1, enabled: true });
                  await refreshTemplates();
                }}
                onUpdate={async (id, patch) => {
                  const updated = await updatePromptTemplate(id, patch);
                  setTemplates((items) => items.map((item) => item.id === id ? updated : item));
                }}
                onDelete={async (id) => {
                  await deletePromptTemplate(id);
                  await refreshTemplates();
                }}
              />
              <Composer
                attachments={pendingAttachments}
                disabled={busy}
                value={composerValue}
                onValueChange={setComposerValue}
                onFiles={handleFiles}
                onRemoveAttachment={(id) => setPendingAttachments((items) => items.filter((item) => item.id !== id))}
                onSend={handleSend}
              />
            </footer>
          </>
        )}
      </section>
      {attachmentDetail && (
        <AttachmentDetailPanel
          attachment={attachmentDetail}
          busy={attachmentBusy}
          onClose={() => setAttachmentDetail(null)}
          onReparse={async () => {
            setAttachmentBusy(true);
            try {
              setAttachmentDetail(await reparseAttachment(attachmentDetail.id));
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setAttachmentBusy(false);
            }
          }}
        />
      )}
      {dragging && <div className="drop-overlay">松开以上传文件</div>}
    </div>
  );
}
