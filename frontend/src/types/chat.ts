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
  created_at: string;
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
