import { Activity, MessageSquarePlus, Search, Trash2 } from "lucide-react";
import type { Conversation, ConversationSearchResult } from "../types/chat";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  searchValue: string;
  searchResults: ConversationSearchResult[];
  onNew: () => void;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDiagnostics: () => void;
};

export function Sidebar({ conversations, activeId, searchValue, searchResults, onNew, onSearch, onSelect, onDelete, onDiagnostics }: Props) {
  const searching = searchValue.trim().length > 0;
  return (
    <aside className="sidebar">
      <button className="new-chat" type="button" onClick={onNew}>
        <MessageSquarePlus size={18} /> 新建会话
      </button>
      <label className="conversation-search">
        <Search size={16} />
        <input value={searchValue} onChange={(event) => onSearch(event.target.value)} placeholder="搜索会话、消息、附件" />
      </label>
      <button className="sidebar-tool" type="button" onClick={onDiagnostics}>
        <Activity size={16} /> Ollama 诊断
      </button>
      <div className="conversation-list">
        {searching &&
          searchResults.map((item) => (
            <div className={`conversation-item search-result ${item.conversation_id === activeId ? "active" : ""}`} key={item.conversation_id}>
              <button type="button" onClick={() => onSelect(item.conversation_id)}>
                <strong>{item.title}</strong>
                <span>{item.matched_type} · {item.matched_text}</span>
              </button>
            </div>
          ))}
        {!searching && conversations.map((item) => (
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
