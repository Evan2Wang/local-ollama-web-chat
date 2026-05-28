import type { Message } from "../types/chat";
import { MessageBubble } from "./MessageBubble";

export function ChatWindow({
  messages,
  streaming,
  retryDisabled,
  onOpenAttachment,
  onRetry
}: {
  messages: Message[];
  streaming: boolean;
  retryDisabled: boolean;
  onOpenAttachment: (id: string) => void;
  onRetry: (message: Message) => void;
}) {
  return (
    <main className="chat-window">
      {messages.length === 0 ? (
        <div className="empty-state">
          <h1>Local Ollama Web Chat</h1>
          <p>选择模型，输入问题，或直接粘贴/拖拽图片和文件开始对话。</p>
        </div>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            retryDisabled={retryDisabled}
            onOpenAttachment={onOpenAttachment}
            onRetry={onRetry}
          />
        ))
      )}
      {streaming && <div className="typing">正在生成...</div>}
    </main>
  );
}
