import { useEffect, useRef } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";

interface MarkdownRendererProps {
  content: string;
  theme?: "dark" | "light";
  emptyText?: string;
}

export function MarkdownRenderer({ content, theme = "dark", emptyText = "暂无内容" }: MarkdownRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !content) return;
    Vditor.preview(ref.current, content, {
      mode: theme,
      theme: { current: theme },
    });
  }, [content, theme]);

  if (!content) {
    return <div className="markdown-empty">{emptyText}</div>;
  }

  return <div ref={ref} className="markdown-preview" />;
}
