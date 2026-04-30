import { useEffect, useRef } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";

interface MarkdownRendererProps {
  content: string;
  theme?: "dark" | "light";
}

export function MarkdownRenderer({ content, theme = "dark" }: MarkdownRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !content) return;
    Vditor.preview(ref.current, content, {
      mode: theme,
      theme: { current: theme },
    });
  }, [content, theme]);

  if (!content) {
    return <div className="text-muted text-sm" style={{ padding: 8 }}>暂无内容</div>;
  }

  return (
    <div
      ref={ref}
      className="markdown-preview"
      style={{ padding: '8px 12px', fontSize: '13px', lineHeight: 1.6 }}
    />
  );
}
