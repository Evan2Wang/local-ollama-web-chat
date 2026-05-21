import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownNodeProps = {
  className?: string;
  children?: React.ReactNode;
};

function nodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return nodeText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children);
  }
  return "";
}

function CodeBlock({ children }: MarkdownNodeProps) {
  const [copied, setCopied] = useState(false);
  const text = nodeText(children).replace(/\n$/, "");
  return (
    <div className="code-wrap">
      <button
        type="button"
        className="copy-code"
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
        title="复制代码"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className, children }: MarkdownNodeProps) => <code className={className}>{children}</code>,
          pre: CodeBlock
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
