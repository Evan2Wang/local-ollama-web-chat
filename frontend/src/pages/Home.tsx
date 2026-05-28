import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  streamRetry,
  updatePromptTemplate,
  uploadAttachments
} from "../api/client";
import { AttachmentDetailPanel } from "../components/AttachmentDetailPanel";
import { ChatWindow } from "../components/ChatWindow";
import { Composer, type ComposerHandle } from "../components/Composer";
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
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [loadedConversationIds, setLoadedConversationIds] = useState<Set<string>>(() => new Set());
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [composerValue, setComposerValue] = useState("");
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [attachmentDetail, setAttachmentDetail] = useState<AttachmentDetail | null>(null);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<ConversationSearchResult[]>([]);
  const [view, setView] = useState<"chat" | "diagnostics">("chat");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [busyConversationIds, setBusyConversationIds] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const composerRef = useRef<ComposerHandle>(null);
  const bootedRef = useRef(false);
  const streamControllersRef = useRef<Map<string, AbortController>>(new Map());

  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeId), [activeId, conversations]);
  const messages = activeId ? messagesByConversation[activeId] || [] : [];
  const activeBusy = activeId ? busyConversationIds.has(activeId) : false;
  const hasActiveGeneration = busyConversationIds.size > 0;
  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => composerRef.current?.focusInput());
  }, []);

  const setConversationMessages = useCallback((conversationId: string, updater: (messages: Message[]) => Message[]) => {
    setMessagesByConversation((items) => ({
      ...items,
      [conversationId]: updater(items[conversationId] || [])
    }));
  }, []);

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
    setConversationMessages(created.id, () => []);
    setLoadedConversationIds((items) => new Set(items).add(created.id));
    return created.id;
  }, [activeId, selectedModel, setConversationMessages]);

  const refreshConversationCache = useCallback(async (id: string) => {
    const detail = await fetchConversation(id);
    setConversations((items) => items.map((item) => (item.id === detail.id ? { ...item, ...detail } : item)));
    setConversationMessages(detail.id, () => detail.messages);
    setLoadedConversationIds((items) => new Set(items).add(detail.id));
    return detail;
  }, [setConversationMessages]);

  const loadConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setPendingAttachments([]);
    const cachedConversation = conversations.find((item) => item.id === id);
    if (cachedConversation) setSelectedModel(cachedConversation.model);
    if (loadedConversationIds.has(id)) {
      return;
    }
    const detail = await fetchConversation(id);
    setSelectedModel(detail.model);
    setConversationMessages(detail.id, () => detail.messages);
    setLoadedConversationIds((items) => new Set(items).add(detail.id));
  }, [conversations, loadedConversationIds, setConversationMessages]);

  const handleNew = useCallback(async () => {
    const created = await createConversation(selectedModel);
    setConversations((items) => [created, ...items]);
    setActiveId(created.id);
    setConversationMessages(created.id, () => []);
    setLoadedConversationIds((items) => new Set(items).add(created.id));
    setPendingAttachments([]);
  }, [selectedModel, setConversationMessages]);

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
      } finally {
        focusComposer();
      }
    },
    [ensureConversation, focusComposer]
  );

  const handleSend = useCallback(
    async (content: string) => {
      setError("");
      const conversationId = await ensureConversation();
      if (busyConversationIds.size > 0) {
        setError("当前已有会话正在生成，请等待完成后再发送。");
        return;
      }
      setBusyConversationIds((items) => new Set(items).add(conversationId));
      const controller = new AbortController();
      streamControllersRef.current.set(conversationId, controller);
      let assistantMessageId = "";
      try {
        const currentAttachments = pendingAttachments;
        setPendingAttachments([]);
        const userMessage = makeLocalMessage("user", content, conversationId, currentAttachments);
        const assistantMessage = makeLocalMessage("assistant", "", conversationId);
        assistantMessageId = assistantMessage.id;
        setConversationMessages(conversationId, (items) => [...items, userMessage, assistantMessage]);
        await streamChat(
          {
            conversation_id: conversationId,
            model: selectedModel,
            content,
            attachment_ids: currentAttachments.map((item) => item.id)
          },
          (chunk) => {
            setConversationMessages(conversationId, (items) =>
              items.map((item) => (item.id === assistantMessage.id ? { ...item, content: item.content + chunk } : item))
            );
          },
          controller.signal
        );
        await refreshConversations();
        await refreshConversationCache(conversationId);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setConversationMessages(conversationId, (items) =>
            items.filter((item) => item.id !== assistantMessageId || item.content.trim().length > 0)
          );
          setError("已停止当前生成。");
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        streamControllersRef.current.delete(conversationId);
        setBusyConversationIds((items) => {
          const next = new Set(items);
          next.delete(conversationId);
          return next;
        });
      }
    },
    [busyConversationIds, ensureConversation, pendingAttachments, refreshConversationCache, refreshConversations, selectedModel, setConversationMessages]
  );

  const handleRetry = useCallback(
    async (message: Message) => {
      const conversationId = message.conversation_id;
      if (busyConversationIds.size > 0) {
        setError("当前已有会话正在生成，请等待完成后再重试。");
        return;
      }
      setError("");
      setBusyConversationIds((items) => new Set(items).add(conversationId));
      const controller = new AbortController();
      streamControllersRef.current.set(conversationId, controller);
      const assistantMessage = makeLocalMessage("assistant", "", conversationId);
      setConversationMessages(conversationId, (items) => [...items, assistantMessage]);
      try {
        await streamRetry(
          { message_id: message.id, model: selectedModel },
          (chunk) => {
            setConversationMessages(conversationId, (items) =>
              items.map((item) => (item.id === assistantMessage.id ? { ...item, content: item.content + chunk } : item))
            );
          },
          controller.signal
        );
        await refreshConversations();
        await refreshConversationCache(conversationId);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setConversationMessages(conversationId, (items) =>
            items.filter((item) => item.id !== assistantMessage.id || item.content.trim().length > 0)
          );
          setError("已停止当前生成。");
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        streamControllersRef.current.delete(conversationId);
        setBusyConversationIds((items) => {
          const next = new Set(items);
          next.delete(conversationId);
          return next;
        });
      }
    },
    [busyConversationIds, refreshConversationCache, refreshConversations, selectedModel, setConversationMessages]
  );

  const cancelGeneration = useCallback(() => {
    streamControllersRef.current.forEach((controller) => controller.abort());
  }, []);

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
    if (!authorized || bootedRef.current) return;
    bootedRef.current = true;
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
        focusComposer();
        handleFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [focusComposer, handleFiles]);

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
      if (files.length) {
        focusComposer();
        handleFiles(files);
      }
    }
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [focusComposer, handleFiles]);

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
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        collapsed={sidebarCollapsed}
        searchValue={searchValue}
        searchResults={searchResults}
        onNew={handleNew}
        onSearch={setSearchValue}
        onSelect={loadConversation}
        onDiagnostics={() => setView("diagnostics")}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onDelete={async (id) => {
          await deleteConversation(id);
          const next = await refreshConversations();
          if (id === activeId) {
            if (next[0]) await loadConversation(next[0].id);
            else {
              setActiveId(null);
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
              </div>
              <div className="topbar-tools">
                <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} />
              </div>
            </header>
            {error && <div className="error-banner">{error}</div>}
            <ChatWindow
              messages={messages}
              streaming={activeBusy}
              retryDisabled={hasActiveGeneration}
              onOpenAttachment={openAttachment}
              onRetry={handleRetry}
            />
            <footer className="composer-stack">
              <PromptTemplateBar
                templates={templates}
                onInsert={(content) => {
                  setComposerValue((value) => value ? `${value}\n\n${content}` : content);
                  focusComposer();
                }}
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
                ref={composerRef}
                attachments={pendingAttachments}
                disabled={hasActiveGeneration}
                value={composerValue}
                onValueChange={setComposerValue}
                onFiles={handleFiles}
                onRemoveAttachment={(id) => setPendingAttachments((items) => items.filter((item) => item.id !== id))}
                onSend={handleSend}
                onCancel={hasActiveGeneration ? cancelGeneration : undefined}
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
