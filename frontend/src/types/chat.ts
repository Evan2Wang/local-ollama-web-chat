export type Attachment = {
  id: string;
  message_id: string | null;
  conversation_id: string;
  filename: string;
  file_type: "image" | "file";
  mime_type: string;
  size: number;
  storage_path: string;
  status: string;
  error_message: string | null;
  is_truncated: boolean;
  original_chars: number;
  used_chars: number;
  created_at: string;
  updated_at: string;
};

export type AttachmentDetail = Attachment & {
  parsed_text_preview: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  attachments: Attachment[];
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  system_prompt: string;
  created_at: string;
  updated_at: string;
};

export type ConversationDetail = Conversation & {
  messages: Message[];
};

export type OllamaModel = {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
};

export type PromptTemplate = {
  id: string;
  name: string;
  content: string;
  category: string;
  sort_order: number;
  enabled: boolean;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

export type ConversationSearchResult = {
  conversation_id: string;
  title: string;
  matched_type: "title" | "message" | "attachment";
  matched_text: string;
  updated_at: string;
};

export type HealthConfig = {
  ollama_base_url: string;
  default_model: string;
  max_file_chars: number;
  auth_enabled: boolean;
};

export type OllamaHealth = {
  ok: boolean;
  ollama_base_url: string;
  tags_url?: string;
  chat_url?: string;
  status_code: number | null;
  models?: OllamaModel[];
  model?: string;
  response?: unknown;
  error?: string;
  detail?: string;
  url?: string;
};
