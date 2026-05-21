import { Paperclip, Send, X } from "lucide-react";
import { ChangeEvent, KeyboardEvent, useRef } from "react";
import type { Attachment } from "../types/chat";
import { AttachmentPreview } from "./AttachmentPreview";

type Props = {
  attachments: Attachment[];
  disabled: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  onSend: (content: string) => void;
};

export function Composer({ attachments, disabled, value, onValueChange, onFiles, onRemoveAttachment, onSend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) onFiles(Array.from(event.target.files));
    event.target.value = "";
  }

  function submit() {
    const content = value.trim();
    if (!content && attachments.length === 0) return;
    onSend(content || "请分析这些附件。");
    onValueChange("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <footer className="composer">
      <AttachmentPreview attachments={attachments} removable onRemove={onRemoveAttachment} />
      <div className="composer-box">
        <button type="button" className="icon-button attach-button" onClick={() => inputRef.current?.click()} title="上传附件">
          <Paperclip className="composer-action-icon" />
        </button>
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入问题，Enter 发送，Shift+Enter 换行；可 Ctrl+V 粘贴图片/文件，或拖拽到窗口"
        />
        <button type="button" className="send-button" disabled={disabled} onClick={submit} title="发送">
          {disabled ? <X className="composer-action-icon" /> : <Send className="composer-action-icon" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={handleFiles}
          accept=".txt,.md,.csv,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp"
        />
      </div>
    </footer>
  );
}
