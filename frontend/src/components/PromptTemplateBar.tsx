import { FormEvent, ReactNode, useState } from "react";
import { CheckSquare, FileText, Globe2, MoreHorizontal, Plus, Presentation, Search, Settings2, Table2, Trash2 } from "lucide-react";
import type { PromptTemplate } from "../types/chat";

type Draft = {
  name: string;
  content: string;
  category: string;
};

const emptyDraft: Draft = { name: "", content: "", category: "自定义" };

const templateIcons: Record<string, ReactNode> = {
  文件总结: <FileText size={15} />,
  提取表格: <Table2 size={15} />,
  生成PPT大纲: <Presentation size={15} />,
  压缩成领导汇报版: <FileText size={15} />,
  翻译成中文: <Globe2 size={15} />,
  提取待办事项: <CheckSquare size={15} />,
  检查逻辑问题: <Search size={15} />
};

export function PromptTemplateBar({
  templates,
  onInsert,
  onCreate,
  onUpdate,
  onDelete
}: {
  templates: PromptTemplate[];
  onInsert: (content: string) => void;
  onCreate: (draft: Draft) => Promise<void>;
  onUpdate: (id: string, patch: Partial<PromptTemplate>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.content.trim()) return;
    await onCreate(draft);
    setDraft(emptyDraft);
  }

  return (
    <section className="prompt-area" aria-label="快捷提示词">
      <div className="prompt-buttons">
        {templates.filter((item) => item.enabled).map((item) => (
          <button
            type="button"
            key={item.id}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(item.content)}
            title={item.content}
          >
            {templateIcons[item.name]}
            {item.name}
          </button>
        ))}
        <button className="prompt-manage" type="button" onClick={() => setManaging((value) => !value)} title="管理快捷提示词">
          {managing ? <Settings2 size={15} /> : <MoreHorizontal size={15} />} {managing ? "管理中" : "更多"}
        </button>
      </div>
      {managing && (
        <div className="prompt-manager">
          <form onSubmit={submit}>
            <input value={draft.name} onChange={(event) => setDraft((item) => ({ ...item, name: event.target.value }))} placeholder="模板名称" />
            <input value={draft.category} onChange={(event) => setDraft((item) => ({ ...item, category: event.target.value }))} placeholder="分类" />
            <textarea value={draft.content} onChange={(event) => setDraft((item) => ({ ...item, content: event.target.value }))} placeholder="模板内容" />
            <button type="submit"><Plus size={15} /> 新增模板</button>
          </form>
          <div className="prompt-template-list">
            {templates.map((item) => (
              <article key={item.id}>
                <input value={item.name} onChange={(event) => onUpdate(item.id, { name: event.target.value })} aria-label="模板名称" />
                <textarea value={item.content} onChange={(event) => onUpdate(item.id, { content: event.target.value })} aria-label="模板内容" />
                <label>
                  <input type="checkbox" checked={item.enabled} onChange={(event) => onUpdate(item.id, { enabled: event.target.checked })} />
                  启用
                </label>
                <button className="icon-button" type="button" onClick={() => onDelete(item.id)} title="删除模板">
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
