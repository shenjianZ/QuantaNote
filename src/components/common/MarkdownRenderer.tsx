import { Children, cloneElement, isValidElement, useCallback, useState, type ReactElement, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import type { Components } from "react-markdown";
import "katex/dist/katex.min.css";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);

interface MarkdownRendererProps {
  content: string;
  theme?: "dark" | "light";
  lang?: "zh_CN" | "en_US";
  emptyText?: string;
}

type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";

function nodeToText(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (isValidElement(child)) {
      return nodeToText((child.props as { children?: ReactNode }).children);
    }
    return "";
  }).join("");
}

function stripLeadingMarker(node: ReactNode, marker: string, removed: { value: boolean }): ReactNode {
  if (typeof node === "string") {
    if (removed.value) return node;
    removed.value = true;
    return node.replace(marker, "").replace(/^\s+/, "");
  }

  if (Array.isArray(node)) {
    return node.map((child) => stripLeadingMarker(child, marker, removed));
  }

  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props.children === undefined) return node;
    return cloneElement(node as ReactElement<{ children?: ReactNode }>, {
      children: stripLeadingMarker(props.children, marker, removed),
    });
  }

  return node;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    || "section";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightCode(code: string, language?: string): string {
  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function CodeBlock({ code, language, lang }: { code: string; language?: string; lang?: "zh_CN" | "en_US" }) {
  const [copied, setCopied] = useState(false);
  const isEnglish = lang === "en_US";

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const label = language || (isEnglish ? "code" : "代码");
  return (
    <figure className="markdown-code-block" data-language={language || undefined}>
      <div className="markdown-code-toolbar">
        <span className="markdown-code-language">{label}</span>
        <button
          className="markdown-code-copy"
          type="button"
          onClick={handleCopy}
          aria-label={isEnglish ? "Copy code" : "复制代码"}
          title={isEnglish ? "Copy code" : "复制代码"}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? (isEnglish ? "Copied" : "已复制") : (isEnglish ? "Copy" : "复制")}</span>
        </button>
      </div>
      <pre>
        <code
          className={`hljs${language ? ` language-${language}` : ""}`}
          dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
        />
      </pre>
    </figure>
  );
}

function getCalloutKind(value: string): { kind: CalloutKind; marker: string } | null {
  const match = value.trimStart().match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
  if (!match) return null;
  return { kind: match[1].toLowerCase() as CalloutKind, marker: match[0] };
}

function calloutLabel(kind: CalloutKind, lang?: "zh_CN" | "en_US"): string {
  if (lang === "en_US") {
    return {
      note: "Note",
      tip: "Tip",
      important: "Important",
      warning: "Warning",
      caution: "Caution",
    }[kind];
  }
  return {
    note: "提示",
    tip: "技巧",
    important: "重点",
    warning: "警告",
    caution: "注意",
  }[kind];
}

export function MarkdownRenderer({ content, theme = "dark", lang, emptyText }: MarkdownRendererProps) {
  const { t } = useTranslation();
  const resolvedEmptyText = emptyText ?? t("common:emptyItem.noContent");
  const headingCounts = new Map<string, number>();

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return;

    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      openUrl(anchor.href).catch(() => {});
    }
  }, []);

  if (!content.trim()) {
    return <div className="markdown-empty">{resolvedEmptyText}</div>;
  }

  const makeHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => ({ children }: { children?: ReactNode }) => {
    const text = nodeToText(children);
    const base = slugify(text);
    const count = headingCounts.get(base) ?? 0;
    headingCounts.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

    return (
      <Tag id={id} className="markdown-heading">
        <span>{children}</span>
        <a className="markdown-heading-anchor" href={`#${id}`} aria-label={lang === "en_US" ? "Link to heading" : "链接到标题"}>
          #
        </a>
      </Tag>
    );
  };

  const components: Components = {
    h1: makeHeading(1),
    h2: makeHeading(2),
    h3: makeHeading(3),
    h4: makeHeading(4),
    h5: makeHeading(5),
    h6: makeHeading(6),
    a: ({ children, href, title }) => (
      <a href={href} title={title} rel={href?.startsWith("http") ? "noreferrer" : undefined}>
        {children}
      </a>
    ),
    blockquote: ({ children }) => {
      const childNodes = Children.toArray(children);
      const firstContentIndex = childNodes.findIndex((child) => nodeToText(child).trim().length > 0);
      const firstChild = firstContentIndex >= 0 ? childNodes[firstContentIndex] : null;
      const callout = getCalloutKind(nodeToText(firstChild ?? children));
      if (!callout) return <blockquote>{children}</blockquote>;

      const removed = { value: false };
      const cleanedFirst = stripLeadingMarker(firstChild, callout.marker, removed);
      const cleanedChildren = [
        ...childNodes.slice(0, firstContentIndex),
        ...(nodeToText(cleanedFirst).trim() ? [cleanedFirst] : []),
        ...childNodes.slice(firstContentIndex + 1),
      ];

      return (
        <aside className={`markdown-callout markdown-callout--${callout.kind}`} data-callout={callout.kind}>
          <div className="markdown-callout-label">{calloutLabel(callout.kind, lang)}</div>
          <div className="markdown-callout-content">{cleanedChildren}</div>
        </aside>
      );
    },
    table: ({ children }) => (
      <div className="markdown-table-wrap">
        <table>{children}</table>
      </div>
    ),
    img: ({ src, alt, title }) => {
      if (!src) return null;
      return (
        <span className="markdown-image-frame">
          <img src={src} alt={alt || ""} title={title} loading="lazy" />
          {alt && <span className="markdown-image-caption">{alt}</span>}
        </span>
      );
    },
    input: ({ type, checked }) => {
      if (type !== "checkbox") return <input type={type} checked={checked} readOnly />;
      return (
        <span className={`markdown-task-box${checked ? " is-checked" : ""}`} aria-hidden="true">
          {checked && <Check className="h-3 w-3" />}
        </span>
      );
    },
    pre: ({ children }) => <>{children}</>,
    code: ({ children, className }) => {
      const language = /language-([\w-]+)/.exec(className || "")?.[1];
      const rawCode = nodeToText(children);
      const code = rawCode.replace(/\n$/, "");
      const isBlock = Boolean(language) || rawCode.includes("\n");
      if (!isBlock) return <code className={className}>{children}</code>;
      return <CodeBlock code={code} language={language} lang={lang} />;
    },
  };

  return (
    <article
      className="markdown-preview"
      data-theme={theme}
      data-testid="markdown-preview"
      onClick={handleClick}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
