import type { Message } from "../types/chat";
import { MessageBubble } from "./MessageBubble";

export function ChatWindow({
  messages,
  streaming,
  onOpenAttachment
}: {
  messages: Message[];
  streaming: boolean;
  onOpenAttachment: (id: string) => void;
}) {
  return (
    <main className="chat-window">
      {messages.length === 0 ? (
        <div className="empty-state">
          <h1>Local Ollama Web Chat</h1>
          <p>选择模型，输入问题，或直接粘贴/拖拽图片和文件开始对话。</p>
        </div>
      ) : (
        messages.map((message) => <MessageBubble key={message.id} message={message} onOpenAttachment={onOpenAttachment} />)
      )}
      {streaming && <div className="typing">正在生成...</div>}
    </main>
  );
}
