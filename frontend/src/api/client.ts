import type { Attachment, Conversation, ConversationDetail, OllamaModel } from "../types/chat";

export const apiBase = "";

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
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

export async function uploadAttachments(conversationId: string, files: File[]): Promise<Attachment[]> {
  const form = new FormData();
  form.append("conversation_id", conversationId);
  files.forEach((file) => form.append("files", file));
  const response = await fetch("/api/attachments", { method: "POST", body: form });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export async function streamChat(
  payload: { conversation_id: string; model: string; content: string; attachment_ids: string[] },
  onChunk: (chunk: string) => void
): Promise<void> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
