import type {
  Attachment,
  AttachmentDetail,
  Conversation,
  ConversationDetail,
  ConversationSearchResult,
  HealthConfig,
  OllamaHealth,
  OllamaModel,
  PromptTemplate
} from "../types/chat";

export const apiBase = "";
const tokenKey = "local-ollama-web-chat-token";

export function storedToken(): string {
  return localStorage.getItem(tokenKey) || "";
}

export function saveToken(token: string): void {
  localStorage.setItem(tokenKey, token);
}

export function clearToken(): void {
  localStorage.removeItem(tokenKey);
}

function authHeaders(): HeadersInit {
  const token = storedToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers || {}) },
    ...init
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function fetchModels(): Promise<{ default_model: string; models: OllamaModel[] }> {
  return json("/api/models");
}

export async function createConversation(model: string): Promise<Conversation> {
  return json("/api/conversations", { method: "POST", body: JSON.stringify({ model }) });
}

export async function fetchConversations(): Promise<Conversation[]> {
  return json("/api/conversations");
}

export async function fetchConversation(id: string): Promise<ConversationDetail> {
  return json(`/api/conversations/${id}`);
}

export async function deleteConversation(id: string): Promise<void> {
  await json(`/api/conversations/${id}`, { method: "DELETE" });
}

export async function searchConversations(q: string): Promise<ConversationSearchResult[]> {
  return json(`/api/conversations/search?q=${encodeURIComponent(q)}`);
}

export async function uploadAttachments(conversationId: string, files: File[]): Promise<Attachment[]> {
  const form = new FormData();
  form.append("conversation_id", conversationId);
  files.forEach((file) => form.append("files", file));
  const response = await fetch("/api/attachments", { method: "POST", headers: authHeaders(), body: form });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function fetchAttachment(id: string): Promise<AttachmentDetail> {
  return json(`/api/attachments/${id}`);
}

export async function reparseAttachment(id: string): Promise<AttachmentDetail> {
  return json(`/api/attachments/${id}/reparse`, { method: "POST" });
}

export async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  return json("/api/prompt-templates");
}

export async function createPromptTemplate(payload: Pick<PromptTemplate, "name" | "content" | "category" | "sort_order" | "enabled">): Promise<PromptTemplate> {
  return json("/api/prompt-templates", { method: "POST", body: JSON.stringify(payload) });
}

export async function updatePromptTemplate(id: string, payload: Partial<PromptTemplate>): Promise<PromptTemplate> {
  return json(`/api/prompt-templates/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deletePromptTemplate(id: string): Promise<void> {
  await json(`/api/prompt-templates/${id}`, { method: "DELETE" });
}

export async function fetchHealthConfig(): Promise<HealthConfig> {
  return json("/api/health/config");
}

export async function fetchOllamaHealth(): Promise<OllamaHealth> {
  return json("/api/health/ollama");
}

export async function fetchChatHealth(): Promise<OllamaHealth> {
  return json("/api/health/chat");
}

export async function checkToken(token: string): Promise<{ ok: boolean; auth_enabled: boolean }> {
  return json("/api/auth/check", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

export async function streamChat(
  payload: { conversation_id: string; model: string; content: string; attachment_ids: string[] },
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ...payload, stream: true })
  });
  if (!response.ok || !response.body) throw new Error(await response.text());
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
