import { useCallback, useEffect, useRef } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { openUrl } from "@tauri-apps/plugin-opener";
import { VDITOR_CDN, VDITOR_LANG } from "../../utils/vditorConfig";

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
      cdn: VDITOR_CDN,
      lang: VDITOR_LANG,
      mode: theme,
      theme: { current: theme },
    });
  }, [content, theme]);

  // 拦截链接点击：Ctrl/Meta+click 在系统浏览器中打开，普通点击不做跳转
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (anchor && anchor.href) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        openUrl(anchor.href).catch(() => {});
      }
    }
  }, []);

  if (!content) {
    return <div className="markdown-empty">{emptyText}</div>;
  }

  return <div ref={ref} className="markdown-preview" onClick={handleClick} />;
}
