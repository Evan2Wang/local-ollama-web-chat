import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createConversation,
  deleteConversation,
  fetchConversation,
  fetchConversations,
  fetchModels,
  streamChat,
  uploadAttachments
} from "../api/client";
import { ChatWindow } from "../components/ChatWindow";
import { Composer } from "../components/Composer";
import { ModelSelector } from "../components/ModelSelector";
import { Sidebar } from "../components/Sidebar";
import type { Attachment, Conversation, Message, OllamaModel } from "../types/chat";

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
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
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
    async function boot() {
      try {
        const modelData = await fetchModels();
        setModels(modelData.models);
        setSelectedModel(modelData.default_model || modelData.models[0]?.name || "");
        const list = await refreshConversations();
        if (list[0]) await loadConversation(list[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    boot();
  }, [loadConversation, refreshConversations]);

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

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onNew={handleNew}
        onSelect={loadConversation}
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
        <header className="topbar">
          <div>
            <strong>{activeConversation?.title || "新会话"}</strong>
            <span>本地单用户 · SQLite 历史</span>
          </div>
          <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} />
        </header>
        {error && <div className="error-banner">{error}</div>}
        <ChatWindow messages={messages} streaming={busy} />
        <Composer
          attachments={pendingAttachments}
          disabled={busy}
          onFiles={handleFiles}
          onRemoveAttachment={(id) => setPendingAttachments((items) => items.filter((item) => item.id !== id))}
          onSend={handleSend}
        />
      </section>
      {dragging && <div className="drop-overlay">松开以上传文件</div>}
    </div>
  );
}
