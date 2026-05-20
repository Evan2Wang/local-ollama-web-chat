import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { Message } from "../types/chat";
import { AttachmentPreview } from "./AttachmentPreview";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  return (
    <article className={`message ${isUser ? "user" : "assistant"}`}>
      <div className="message-head">
        <span>{isUser ? "你" : "助手"}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            navigator.clipboard.writeText(message.content);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          title="复制消息"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <AttachmentPreview attachments={message.attachments || []} />
      {isUser ? <p className="plain-message">{message.content}</p> : <MarkdownRenderer content={message.content} />}
    </article>
  );
}
