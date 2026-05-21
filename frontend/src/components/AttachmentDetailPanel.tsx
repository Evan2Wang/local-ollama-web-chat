import { RefreshCw, X } from "lucide-react";
import type { AttachmentDetail } from "../types/chat";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function AttachmentDetailPanel({
  attachment,
  busy,
  onClose,
  onReparse
}: {
  attachment: AttachmentDetail;
  busy: boolean;
  onClose: () => void;
  onReparse: () => void;
}) {
  return (
    <aside className="detail-panel" aria-label="附件解析详情">
      <header>
        <div>
          <strong>{attachment.filename}</strong>
          <span>{attachment.mime_type || attachment.file_type}</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} title="关闭">
          <X size={18} />
        </button>
      </header>
      <dl>
        <dt>文件大小</dt><dd>{attachment.size} B</dd>
        <dt>上传时间</dt><dd>{formatDate(attachment.created_at)}</dd>
        <dt>解析状态</dt><dd>{attachment.status}</dd>
        <dt>截断</dt><dd>{attachment.is_truncated ? "是" : "否"}</dd>
        <dt>原始字符</dt><dd>{attachment.original_chars}</dd>
        <dt>送入模型</dt><dd>{attachment.used_chars}</dd>
        <dt>错误信息</dt><dd>{attachment.error_message || "-"}</dd>
      </dl>
      {attachment.file_type === "file" && (
        <button className="subtle-button" type="button" onClick={onReparse} disabled={busy}>
          <RefreshCw size={16} /> 重新解析
        </button>
      )}
      <section className="parsed-preview">
        <h2>解析文本预览</h2>
        <pre>{attachment.parsed_text_preview || "暂无可预览的解析文本。"}</pre>
      </section>
    </aside>
  );
}
