import { Children, cloneElement, isValidElement, memo, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Check, CircleAlert, Copy, Info, Lightbulb, OctagonAlert, TriangleAlert } from "lucide-react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import Vditor from "vditor";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkDefinitionList, { defListHastHandlers } from "remark-definition-list";
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
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import type { Components } from "react-markdown";
import { VDITOR_CDN } from "../../utils/vditorConfig";
import { copyTextToSystemClipboard } from "../../utils/clipboard";
import { useToastStore } from "../../stores/toastStore";
import type { MarkdownAttachment } from "../../utils/markdownAttachments";
import { NotePropertiesBadges } from "./NotePropertiesBadges";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { hasNoteProperties, parseNoteProperties, stripFrontmatter } from "../../utils/frontmatter";
import {
  getAttachmentIdFromSource,
  getAttachmentImageOptions,
  getAttachmentImageStyle,
  resolveAttachmentSource,
} from "../../utils/markdownAttachments";
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

const markdownSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "attachment", "note"],
    src: [...(defaultSchema.protocols?.src ?? []), "attachment"],
  },
  attributes: {
    ...defaultSchema.attributes,
    audio: ["controls", "preload", "src"],
    source: [...(defaultSchema.attributes?.source ?? []), "src"],
    video: ["controls", "preload", "poster", "src"],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "audio", "video", "dl", "dt", "dd"],
};

interface MarkdownRendererProps {
  content: string;
  theme?: "dark" | "light";
  lang?: "zh_CN" | "en_US";
  emptyText?: string;
  attachments?: readonly MarkdownAttachment[];
  onNoteLinkClick?: (targetTitle: string) => void;
}

type MarkdownNode = {
  type?: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
};

function splitWikiLink(value: string): { target: string; label: string } | null {
  const raw = value.trim();
  if (!raw) return null;
  const [targetPart, ...labelParts] = raw.split("|");
  const target = targetPart.trim();
  if (!target) return null;
  const label = labelParts.join("|").trim() || target;
  return { target, label };
}

function remarkWikiLinks() {
  return (tree: MarkdownNode) => {
    const splitText = (value: string): MarkdownNode[] => {
      const children: MarkdownNode[] = [];
      let cursor = 0;
      const pattern = /\[\[([^\]\n]+)\]\]/g;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(value))) {
        if (match.index > cursor) {
          children.push({ type: "text", value: value.slice(cursor, match.index) });
        }
        const link = splitWikiLink(match[1]);
        if (!link) {
          children.push({ type: "text", value: match[0] });
        } else {
          children.push({
            type: "link",
            url: `note://${encodeURIComponent(link.target)}`,
            children: [{ type: "text", value: link.label }],
          });
        }
        cursor = match.index + match[0].length;
      }
      if (children.length === 0) return [{ type: "text", value }];
      if (cursor < value.length) {
        children.push({ type: "text", value: value.slice(cursor) });
      }
      return children;
    };

    const visit = (node: MarkdownNode) => {
      if (!node.children) return;
      node.children = node.children.flatMap((child) => {
        if (child.type === "text" && child.value) return splitText(child.value);
        visit(child);
        return [child];
      });
    };

    visit(tree);
  };
}

function getNoteTargetFromHref(href?: string): string | null {
  if (!href?.toLowerCase().startsWith("note://")) return null;
  try {
    return decodeURIComponent(href.slice("note://".length)).trim() || null;
  } catch {
    return href.slice("note://".length).trim() || null;
  }
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

function CodeBlock({
  code,
  language,
  lang,
  theme,
}: {
  code: string;
  language?: string;
  lang?: "zh_CN" | "en_US";
  theme: "dark" | "light";
}) {
  const [copied, setCopied] = useState(false);
  const isEnglish = lang === "en_US";

  const handleCopy = async () => {
    try {
      await copyTextToSystemClipboard(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
      useToastStore.getState().addToast("success", isEnglish ? "Copied to clipboard" : "已复制到剪贴板");
    } catch {
      setCopied(false);
      useToastStore.getState().addToast("error", isEnglish ? "Copy failed" : "复制失败");
    }
  };

  const label = language || (isEnglish ? "code" : "代码");

  if (language === "mermaid" || language === "flowchart") {
    return <DiagramBlock code={code} language={language} lang={lang} theme={theme} />;
  }

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

function DiagramBlock({
  code,
  language,
  lang,
  theme,
}: {
  code: string;
  language: "mermaid" | "flowchart";
  lang?: "zh_CN" | "en_US";
  theme: "dark" | "light";
}) {
  const codeRef = useRef<HTMLElement>(null);
  const isEnglish = lang === "en_US";

  useEffect(() => {
    const codeElement = codeRef.current;
    const container = codeElement?.closest<HTMLElement>(".markdown-diagram-block");
    if (!codeElement || !container) return;

    codeElement.textContent = code;
    codeElement.removeAttribute("data-processed");
    if (language === "mermaid") {
      Vditor.mermaidRender(container, VDITOR_CDN, theme);
    } else {
      Vditor.flowchartRender(container, VDITOR_CDN);
    }

    return () => {
      codeElement.textContent = code;
      codeElement.removeAttribute("data-processed");
    };
  }, [code, language, theme]);

  const handleCopy = async () => {
    try {
      await copyTextToSystemClipboard(code);
      useToastStore.getState().addToast("success", isEnglish ? "Copied to clipboard" : "已复制到剪贴板");
    } catch {
      // Diagram rendering should remain usable when clipboard access is unavailable.
      useToastStore.getState().addToast("error", isEnglish ? "Copy failed" : "复制失败");
    }
  };

  return (
    <figure className="markdown-code-block markdown-diagram-block" data-language={language}>
      <div className="markdown-code-toolbar">
        <span className="markdown-code-language">{language}</span>
        <button
          className="markdown-code-copy"
          type="button"
          onClick={handleCopy}
          aria-label={isEnglish ? "Copy code" : "复制代码"}
          title={isEnglish ? "Copy code" : "复制代码"}
        >
          <Copy className="h-3.5 w-3.5" />
          <span>{isEnglish ? "Copy" : "复制"}</span>
        </button>
      </div>
      <pre>
        <code ref={codeRef} className={`language-${language}`}>{code}</code>
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

function CalloutIcon({ kind }: { kind: CalloutKind }) {
  const Icon = {
    note: Info,
    tip: Lightbulb,
    important: CircleAlert,
    warning: TriangleAlert,
    caution: OctagonAlert,
  }[kind];
  return <Icon className="markdown-callout-icon" aria-hidden="true" />;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, theme = "dark", lang, emptyText, attachments = [], onNoteLinkClick }: MarkdownRendererProps) {
  const { t } = useTranslation();
  const resolvedEmptyText = emptyText ?? t("common:emptyItem.noContent");
  const properties = parseNoteProperties(content);
  const bodyContent = stripFrontmatter(content);
  const headingCounts = new Map<string, number>();
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  const handleClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const image = (e.target as HTMLElement).closest("img");
    if (image && e.currentTarget.contains(image) && !image.classList.contains("emoji")) {
      const src = image.currentSrc || image.src || image.getAttribute("src") || "";
      if (src) {
        e.preventDefault();
        e.stopPropagation();
        setPreviewImage({
          src,
          alt: image.getAttribute("alt") || t("editor:imageEditor.unknownImage"),
        });
      }
      return;
    }

    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;

    const attachmentId = anchor.getAttribute("data-attachment-id");
    const attachment = attachmentId ? attachments.find((candidate) => candidate.id === attachmentId) : undefined;
    if (attachment && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      openPath(attachment.file_path).catch(() => {});
      return;
    }

    const noteTarget = anchor.getAttribute("data-note-target");
    if (noteTarget) {
      if (onNoteLinkClick) {
        e.preventDefault();
        onNoteLinkClick(noteTarget);
      }
      return;
    }

    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return;

    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      openUrl(anchor.href).catch(() => {});
    }
  }, [attachments, onNoteLinkClick, t]);

  if (!bodyContent.trim() && !hasNoteProperties(properties)) {
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
    a: ({ children, href, title }) => {
      const attachmentId = href ? getAttachmentIdFromSource(href) : null;
      const noteTarget = getNoteTargetFromHref(href);
      return (
      <a
        href={href ? resolveAttachmentSource(href, attachments) : href}
        data-attachment-id={attachmentId ?? undefined}
        data-note-target={noteTarget ?? undefined}
        title={title}
        rel={href?.startsWith("http") ? "noreferrer" : undefined}
      >
        {children}
      </a>
      );
    },
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
          <div className="markdown-callout-label">
            <CalloutIcon kind={callout.kind} />
            <span>{calloutLabel(callout.kind, lang)}</span>
          </div>
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
      const imageOptions = getAttachmentImageOptions(src);
      const imageAlignment = imageOptions.align ?? "center";
      return (
        <span className={`markdown-image-frame markdown-image-frame--${imageAlignment}`}>
          <img
            src={resolveAttachmentSource(src, attachments)}
            alt={alt || ""}
            title={title}
            style={getAttachmentImageStyle(imageOptions)}
            loading="eager"
            decoding="async"
          />
          {alt && <span className="markdown-image-caption">{alt}</span>}
        </span>
      );
    },
    audio: ({ children, ...props }) => (
      <figure className="markdown-media-frame markdown-audio-frame">
        <audio {...props} controls preload="metadata">{children}</audio>
      </figure>
    ),
    video: ({ children, ...props }) => (
      <figure className="markdown-media-frame markdown-video-frame">
        <video {...props} controls preload="metadata">{children}</video>
      </figure>
    ),
    input: ({ type, checked }) => {
      if (type !== "checkbox") return <input type={type} checked={checked} readOnly />;
      return (
        <span className={`markdown-task-box${checked ? " is-checked" : ""}`} aria-hidden="true">
          {checked && <Check className="h-3 w-3" />}
        </span>
      );
    },
    pre: ({ children }) => {
      const renderedCodeBlock = Children.toArray(children).some(
        (child) => isValidElement(child) && child.type === CodeBlock,
      );
      return renderedCodeBlock ? <>{children}</> : <pre>{children}</pre>;
    },
    code: ({ children, className }) => {
      const language = /language-([\w-]+)/.exec(className || "")?.[1];
      const rawCode = nodeToText(children);
      const code = rawCode.replace(/\n$/, "");
      const isBlock = Boolean(language) || rawCode.includes("\n");
      if (!isBlock) return <code className={className}>{children}</code>;
      return <CodeBlock code={code} language={language} lang={lang} theme={theme} />;
    },
  };

  return (
    <article
      className="markdown-preview"
      data-theme={theme}
      data-testid="markdown-preview"
      onClick={handleClick}
    >
      <NotePropertiesBadges properties={properties} testId="markdown-properties" />
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath, remarkDefinitionList, remarkWikiLinks]}
        remarkRehypeOptions={{ handlers: defListHastHandlers }}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema], rehypeKatex]}
        urlTransform={(url) => {
          const normalized = url.toLowerCase();
          return normalized.startsWith("attachment://") || normalized.startsWith("note://")
            ? url
            : defaultUrlTransform(url);
        }}
        components={components}
      >
        {bodyContent}
      </ReactMarkdown>
      <ImagePreviewModal
        open={Boolean(previewImage)}
        src={previewImage?.src ?? ""}
        alt={previewImage?.alt ?? ""}
        onClose={() => setPreviewImage(null)}
        testIdPrefix="reader-image-preview"
      />
    </article>
  );
});
