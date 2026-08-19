import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MarkdownHeading } from "../../utils/markdownOutline";

interface DocumentOutlineProps {
  headings: MarkdownHeading[];
  visible: boolean;
  onToggle: () => void;
  onSelect: (index: number) => void;
  activeIndex?: number;
  showToggle?: boolean;
  className?: string;
}

interface DocumentOutlineToggleProps {
  visible: boolean;
  onToggle: () => void;
  testId?: string;
  ariaLabel?: string;
}

export function DocumentOutlineToggle({ visible, onToggle, testId = "document-outline-toggle", ariaLabel }: DocumentOutlineToggleProps) {
  const { t } = useTranslation(["document"]);
  const label = ariaLabel ?? (visible ? t("document:outline.hide") : t("document:outline.show"));

  return (
    <button
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
      type="button"
      aria-label={label}
      aria-pressed={visible}
      data-testid={testId}
      title={label}
      onClick={onToggle}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </button>
  );
}

export function DocumentOutline({ headings, visible, onToggle, onSelect, activeIndex = -1, showToggle = true, className = "" }: DocumentOutlineProps) {
  const { t } = useTranslation(["document"]);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!visible || activeIndex < 0) return;
    const nav = navRef.current;
    const item = activeItemRef.current;
    if (!nav || !item) return;

    // 只滚动目录列表本身，避免 scrollIntoView 把正文预览也一起滚动。
    if (nav.clientHeight > 0 && item.offsetHeight > 0) {
      const navRect = nav.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const itemTop = nav.scrollTop + itemRect.top - navRect.top;
      const itemBottom = itemTop + itemRect.height;
      const visibleTop = nav.scrollTop;
      const visibleBottom = visibleTop + nav.clientHeight;

      if (itemTop < visibleTop) {
        nav.scrollTop = itemTop;
      } else if (itemBottom > visibleBottom) {
        nav.scrollTop = itemBottom - nav.clientHeight;
      }
      return;
    }

    // jsdom 等没有布局尺寸的环境保留降级路径，浏览器中不会触发这里。
    const scrollIntoView = item.scrollIntoView;
    if (typeof scrollIntoView === "function") {
      scrollIntoView.call(item, {
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeIndex, visible]);

  return (
    <section className={`flex min-h-0 flex-none flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3 ${className}`} data-testid="document-outline">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--text)]">{t("document:outline.title")}</h2>
        {showToggle && <DocumentOutlineToggle visible={visible} onToggle={onToggle} />}
      </div>

      {visible && (
        headings.length > 0 ? (
          <nav ref={navRef} className="mt-2 min-h-0 shrink-0 overflow-y-auto overscroll-contain lg:max-h-[calc(100vh-11rem)] lg:flex-1" aria-label={t("document:outline.title")}>
            <ol className="space-y-0.5">
              {headings.map((heading) => (
                <li key={heading.index}>
                  <button
                    ref={heading.index === activeIndex ? activeItemRef : undefined}
                    className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--hover)] ${heading.index === activeIndex ? "font-medium text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                    style={{ paddingLeft: `${0.5 + (heading.level - 1) * 0.75}rem` }}
                    type="button"
                    data-testid={`document-outline-item-${heading.index}`}
                    aria-current={heading.index === activeIndex ? "location" : undefined}
                    onClick={() => onSelect(heading.index)}
                  >
                    {heading.text}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        ) : (
          <p className="mt-3 text-xs text-[var(--muted)]">{t("document:outline.empty")}</p>
        )
      )}
    </section>
  );
}
