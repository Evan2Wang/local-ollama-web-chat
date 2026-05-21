import { Check, Copy, FileCode2, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import type { Message } from "../types/chat";
import { copyMarkdown, copyRichText } from "../utils/clipboard";
import { AttachmentPreview } from "./AttachmentPreview";
import { MarkdownRenderer } from "./MarkdownRenderer";

export function MessageBubble({
  message,
  retryDisabled,
  onOpenAttachment,
  onRetry
}: {
  message: Message;
  retryDisabled: boolean;
  onOpenAttachment: (id: string) => void;
  onRetry: (message: Message) => void;
}) {
  const [copiedMode, setCopiedMode] = useState<"markdown" | "rich" | null>(null);
  const bubbleRef = useRef<HTMLElement>(null);
  const isUser = message.role === "user";

  function flashCopied(mode: "markdown" | "rich") {
    setCopiedMode(mode);
    window.setTimeout(() => setCopiedMode(null), 1200);
  }

  async function handleMarkdownCopy() {
    if (await copyMarkdown(message.content)) flashCopied("markdown");
  }

  async function handleRichCopy() {
    const markdownBody = bubbleRef.current?.querySelector(".markdown");
    if (!markdownBody) {
      await handleMarkdownCopy();
      return;
    }

    const clone = markdownBody.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button").forEach((button) => button.remove());
    if (await copyRichText(message.content, clone.innerHTML)) flashCopied("rich");
  }

  return (
    <article ref={bubbleRef} className={`message ${isUser ? "user" : "assistant"}`}>
      <div className="message-head">
        <span>{isUser ? "你" : "助手"}</span>
        <div className="message-copy-actions">
          <button type="button" className="icon-button" onClick={handleMarkdownCopy} title={isUser ? "复制消息" : "复制 Markdown"}>
            {copiedMode === "markdown" ? <Check size={15} /> : <Copy size={15} />}
          </button>
          {!isUser && (
            <button type="button" className="icon-button" onClick={handleRichCopy} title="复制富文本">
              {copiedMode === "rich" ? <Check size={15} /> : <FileCode2 size={15} />}
            </button>
          )}
          {isUser && !message.id.startsWith("local_") && (
            <button type="button" className="icon-button" disabled={retryDisabled} onClick={() => onRetry(message)} title="重试这条消息">
              <RotateCw size={15} />
            </button>
          )}
        </div>
      </div>
      <AttachmentPreview attachments={message.attachments || []} onOpen={onOpenAttachment} />
      {isUser ? <p className="plain-message">{message.content}</p> : <MarkdownRenderer content={message.content} />}
    </article>
  );
}
