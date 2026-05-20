import { FileText, Image, X } from "lucide-react";
import type { Attachment } from "../types/chat";

type Props = {
  attachments: Attachment[];
  removable?: boolean;
  onRemove?: (id: string) => void;
};

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentPreview({ attachments, removable = false, onRemove }: Props) {
  if (!attachments.length) return null;
  return (
    <div className="attachments">
      {attachments.map((att) => (
        <div className={att.file_type === "image" ? "image-chip" : "file-chip"} key={att.id}>
          {att.file_type === "image" ? (
            <a href={att.storage_path} target="_blank" rel="noreferrer">
              <img src={att.storage_path} alt={att.filename} />
            </a>
          ) : (
            <FileText size={18} />
          )}
          <span className="attachment-meta">
            {att.file_type === "image" ? <Image size={14} /> : null}
            <span title={att.filename}>{att.filename}</span>
            <small>{formatSize(att.size)} · {att.status}</small>
          </span>
          {removable && (
            <button className="icon-button" type="button" onClick={() => onRemove?.(att.id)} title="移除附件">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
