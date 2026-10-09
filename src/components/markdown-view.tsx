import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="md-preview max-h-[28rem] min-h-44 overflow-auto rounded-md border bg-card px-4 py-3 text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{ a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer nofollow" /> }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
