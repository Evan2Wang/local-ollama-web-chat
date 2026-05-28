import { Activity, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Search, Trash2 } from "lucide-react";
import type { Conversation, ConversationSearchResult } from "../types/chat";

type Props = {
  conversations: Conversation[];
  activeId: string | null;
  collapsed: boolean;
  searchValue: string;
  searchResults: ConversationSearchResult[];
  onNew: () => void;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDiagnostics: () => void;
  onToggleCollapse: () => void;
};

export function Sidebar({
  conversations,
  activeId,
  collapsed,
  searchValue,
  searchResults,
  onNew,
  onSearch,
  onSelect,
  onDelete,
  onDiagnostics,
  onToggleCollapse
}: Props) {
  const searching = searchValue.trim().length > 0;
  function selectConversation(id: string) {
    onSelect(id);
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-primary-actions">
        <button className="new-chat" type="button" onClick={onNew} title="新建会话">
          <MessageSquarePlus size={18} />
          <span>新建会话</span>
        </button>
        <button
          className="sidebar-toggle"
          type="button"
          onPointerDown={(event) => {
            event.preventDefault();
            onToggleCollapse();
          }}
          onClick={(event) => {
            if (event.detail === 0) onToggleCollapse();
          }}
          title={collapsed ? "展开菜单" : "收起菜单"}
          aria-label={collapsed ? "展开菜单" : "收起菜单"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
      {!collapsed && (
        <>
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
                <div
                  className={`conversation-item search-result ${item.conversation_id === activeId ? "active" : ""}`}
                  key={item.conversation_id}
                  onClick={() => selectConversation(item.conversation_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectConversation(item.conversation_id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="conversation-main">
                    <strong>{item.title}</strong>
                    <span>{item.matched_type} · {item.matched_text}</span>
                  </div>
                </div>
              ))}
            {!searching && conversations.map((item) => (
              <div
                className={`conversation-item ${item.id === activeId ? "active" : ""}`}
                key={item.id}
                onClick={() => selectConversation(item.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectConversation(item.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="conversation-main">
                  <strong>{item.title}</strong>
                  <span>{item.model}</span>
                </div>
                <button
                  className="icon-button delete-conversation"
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item.id);
                  }}
                  title="删除会话"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
