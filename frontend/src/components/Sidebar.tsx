import { MessageSquarePlus, Trash2 } from "lucide-react";
import type { Conversation } from "../types/chat";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

export function Sidebar({ conversations, activeId, onNew, onSelect, onDelete }: Props) {
  return (
    <aside className="sidebar">
      <button className="new-chat" type="button" onClick={onNew}>
        <MessageSquarePlus size={18} /> 新建会话
      </button>
      <div className="conversation-list">
        {conversations.map((item) => (
          <div className={`conversation-item ${item.id === activeId ? "active" : ""}`} key={item.id}>
            <button type="button" onClick={() => onSelect(item.id)}>
              <strong>{item.title}</strong>
              <span>{item.model}</span>
            </button>
            <button className="icon-button" type="button" onClick={() => onDelete(item.id)} title="删除会话">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
