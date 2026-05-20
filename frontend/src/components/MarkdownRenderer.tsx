import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type CodeProps = {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
};

function CodeBlock({ inline, className, children }: CodeProps) {
  const [copied, setCopied] = useState(false);
  const text = String(children || "").replace(/\n$/, "");
  if (inline) return <code className={className}>{children}</code>;
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
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
