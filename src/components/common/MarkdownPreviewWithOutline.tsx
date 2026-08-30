import { useEffect, useMemo, useRef, useState } from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { DocumentOutline } from "../editor/DocumentOutline";
import { useSettingsStore } from "../../stores/settingsStore";
import { parseMarkdownOutline } from "../../utils/markdownOutline";
import type { MarkdownAttachment } from "../../utils/markdownAttachments";

interface MarkdownPreviewWithOutlineProps {
  content: string;
  theme: "dark" | "light";
  lang?: "zh_CN" | "en_US";
  testId?: string;
  attachments?: readonly MarkdownAttachment[];
  onNoteLinkClick?: (targetTitle: string) => void;
}

export function MarkdownPreviewWithOutline({
  content,
  theme,
  lang,
  testId = "markdown-preview-layout",
  attachments = [],
  onNoteLinkClick,
}: MarkdownPreviewWithOutlineProps) {
  const markdownRef = useRef<HTMLDivElement>(null);
  const showDocumentOutline = useSettingsStore((s) => s.settings.showDocumentOutline);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const headings = useMemo(() => parseMarkdownOutline(content), [content]);
  const [activeHeadingIndex, setActiveHeadingIndex] = useState(headings.length > 0 ? 0 : -1);

  useEffect(() => {
    setActiveHeadingIndex(headings.length > 0 ? 0 : -1);
    const container = markdownRef.current;
    if (!container) return;

    const findScrollParent = () => {
      let parent = container.parentElement;
      while (parent) {
        const style = window.getComputedStyle(parent);
        if (/(auto|scroll|overlay)/.test(`${style.overflow} ${style.overflowY}`)) return parent;
        parent = parent.parentElement;
      }
      return null;
    };

    const updateActiveHeading = () => {
      const headingElements = Array.from(container.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6",
      ));
      if (headingElements.length === 0) {
        setActiveHeadingIndex(-1);
        return;
      }

      const scrollParent = findScrollParent();
      const scrollRect = scrollParent?.getBoundingClientRect();
      const top = scrollRect?.top ?? 0;
      const height = scrollRect?.height || window.innerHeight;
      const threshold = top + Math.min(height * 0.28, 220);
      let nextIndex = 0;
      headingElements.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top <= threshold) nextIndex = index;
      });
      setActiveHeadingIndex((current) => current === nextIndex ? current : nextIndex);
    };

    const scrollParent = findScrollParent();
    const scrollTarget: HTMLElement | Window = scrollParent ?? window;
    const initialUpdate = window.setTimeout(updateActiveHeading, 80);
    scrollTarget.addEventListener("scroll", updateActiveHeading, { passive: true });
    window.addEventListener("resize", updateActiveHeading);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateActiveHeading);
    resizeObserver?.observe(container);
    if (scrollParent) resizeObserver?.observe(scrollParent);
    return () => {
      window.clearTimeout(initialUpdate);
      scrollTarget.removeEventListener("scroll", updateActiveHeading);
      window.removeEventListener("resize", updateActiveHeading);
      resizeObserver?.disconnect();
    };
  }, [headings]);

  function scrollToHeading(index: number) {
    setActiveHeadingIndex(index);
    const container = markdownRef.current;
    const heading = container?.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6",
    )[index];
    if (!container || !heading) return;

    let scrollParent = container.parentElement;
    while (scrollParent) {
      const style = window.getComputedStyle(scrollParent);
      if (/(auto|scroll|overlay)/.test(`${style.overflow} ${style.overflowY}`)) break;
      scrollParent = scrollParent.parentElement;
    }

    if (scrollParent && scrollParent.clientHeight > 0 && typeof scrollParent.scrollTo === "function") {
      const parentRect = scrollParent.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const centeredTop = scrollParent.scrollTop
        + (headingRect.top - parentRect.top)
        - Math.max(0, (scrollParent.clientHeight - heading.offsetHeight) / 2);
      scrollParent.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });
    } else if (typeof heading.scrollIntoView === "function") {
      heading.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <div
      className={showDocumentOutline ? "grid min-h-0 min-w-0 items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]" : "min-w-0"}
      data-testid={testId}
    >
      <div
        ref={markdownRef}
        className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 sm:rounded-3xl sm:p-5"
        data-testid={`${testId}-markdown`}
      >
        <MarkdownRenderer content={content} theme={theme} lang={lang} attachments={attachments} onNoteLinkClick={onNoteLinkClick} />
      </div>
      {showDocumentOutline && (
        <DocumentOutline
          headings={headings}
          visible
          activeIndex={activeHeadingIndex}
          onToggle={() => updateSetting("showDocumentOutline", false)}
          onSelect={scrollToHeading}
          showToggle={false}
          className="lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-8rem)]"
        />
      )}
    </div>
  );
}
