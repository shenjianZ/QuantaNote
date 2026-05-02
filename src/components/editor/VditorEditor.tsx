import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { openUrl } from "@tauri-apps/plugin-opener";
import { VDITOR_CDN, VDITOR_LANG } from "../../utils/vditorConfig";
import { SearchReplaceBar } from "./SearchReplaceBar";

type VditorToolbarItem = string | {
  name: string;
  icon?: string;
  tip?: string;
  click?: (event: Event) => void;
};

interface VditorEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  theme?: "dark" | "light";
  toolbar?: string[];
  placeholder?: string;
}

export interface VditorEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
}

const DEFAULT_TOOLBAR = [
  "headings", "bold", "italic", "strike", "|",
  "list", "ordered-list", "check", "|",
  "quote", "code", "inline-code", "|",
  "link", "table", "|",
  "undo", "redo",
];

const TABLE_ICON = `
<svg class="quantanote-table-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3.5" y="4.5" width="17" height="15" rx="2.75"></rect>
  <path d="M3.5 9.5h17"></path>
  <path d="M9 9.5v10"></path>
  <path d="M15 9.5v10"></path>
  <path d="M7 7h.01"></path>
  <path d="M11.5 7h.01"></path>
  <path d="M16 7h.01"></path>
</svg>`;

let closeActiveTablePanel: (() => void) | null = null;

function clampTableSize(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

function buildTableMarkdown(rowsInput: number, colsInput: number) {
  const rows = clampTableSize(rowsInput);
  const cols = clampTableSize(colsInput);
  const headers = Array.from({ length: cols }, (_, index) => `列 ${index + 1}`);
  const separators = Array.from({ length: cols }, () => "---");
  const bodyRows = Array.from({ length: Math.max(rows - 1, 0) }, () => {
    return `| ${Array.from({ length: cols }, () => " ").join(" | ")} |`;
  });

  return [
    "",
    `| ${headers.join(" | ")} |`,
    `| ${separators.join(" | ")} |`,
    ...bodyRows,
    "",
  ].join("\n");
}

function showTableSizePanel(event: Event, onInsert: (rows: number, cols: number) => void) {
  event.preventDefault();
  event.stopPropagation();
  closeActiveTablePanel?.();

  const trigger = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>("button, .vditor-toolbar__item")
      : null;
  const panel = document.createElement("div");
  panel.className = "quantanote-vditor-table-panel";

  const title = document.createElement("div");
  title.className = "quantanote-vditor-table-panel__title";
  title.textContent = "插入表格";

  const form = document.createElement("form");
  form.className = "quantanote-vditor-table-panel__form";

  const rowLabel = document.createElement("label");
  rowLabel.textContent = "行";
  const rowInput = document.createElement("input");
  rowInput.type = "number";
  rowInput.min = "1";
  rowInput.step = "1";
  rowInput.value = "3";
  rowLabel.appendChild(rowInput);

  const colLabel = document.createElement("label");
  colLabel.textContent = "列";
  const colInput = document.createElement("input");
  colInput.type = "number";
  colInput.min = "1";
  colInput.step = "1";
  colInput.value = "3";
  colLabel.appendChild(colInput);

  const actions = document.createElement("div");
  actions.className = "quantanote-vditor-table-panel__actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = "取消";

  const insertButton = document.createElement("button");
  insertButton.type = "submit";
  insertButton.textContent = "插入";
  insertButton.className = "primary";

  actions.append(cancelButton, insertButton);
  form.append(rowLabel, colLabel, actions);
  panel.append(title, form);
  document.body.appendChild(panel);

  const triggerRect = trigger?.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const top = (triggerRect?.bottom ?? 0) + 8;
  const left = triggerRect
    ? Math.min(triggerRect.left, window.innerWidth - panelRect.width - 12)
    : Math.max(12, (window.innerWidth - panelRect.width) / 2);
  panel.style.top = `${Math.max(12, top)}px`;
  panel.style.left = `${Math.max(12, left)}px`;

  const closePanel = () => {
    document.removeEventListener("pointerdown", handleOutsidePointer);
    document.removeEventListener("keydown", handleKeydown);
    panel.remove();
    if (closeActiveTablePanel === closePanel) {
      closeActiveTablePanel = null;
    }
  };

  function handleOutsidePointer(pointerEvent: PointerEvent) {
    const target = pointerEvent.target;
    if (target instanceof Node && (panel.contains(target) || trigger?.contains(target))) {
      return;
    }
    closePanel();
  }

  function handleKeydown(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === "Escape") {
      closePanel();
    }
  }

  form.addEventListener("submit", (submitEvent) => {
    submitEvent.preventDefault();
    onInsert(Number(rowInput.value), Number(colInput.value));
    closePanel();
  });
  cancelButton.addEventListener("click", closePanel);

  window.setTimeout(() => {
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleKeydown);
    rowInput.focus();
    rowInput.select();
  });

  closeActiveTablePanel = closePanel;
}

function createTableToolbarItem(insertTable: (rows: number, cols: number) => void): VditorToolbarItem {
  return {
    name: "quantanote-table",
    icon: TABLE_ICON,
    tip: "插入表格",
    click: (event) => showTableSizePanel(event, insertTable),
  };
}

function normalizeToolbar(items: string[], tableItem: VditorToolbarItem): VditorToolbarItem[] {
  return items.map((item) => item === "table" ? tableItem : item);
}

export const VditorEditor = forwardRef<VditorEditorHandle, VditorEditorProps>(function VditorEditor({
  initialValue,
  onChange,
  theme = "dark",
  toolbar,
  placeholder = "开始输入...",
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(initialValue);
  const skipNextValueRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchMatchesRef = useRef<Array<{ start: number; end: number }>>([]);
  const searchIdxRef = useRef(0);

  onChangeRef.current = onChange;
  initialValueRef.current = initialValue;

  // 获取 Vditor 编辑区域元素
  const getContentElement = useCallback((): HTMLElement | null => {
    const container = containerRef.current;
    if (!container) return null;
    // Vditor IR 模式的内容区域
    return container.querySelector(".vditor-ir .vditor-ir__node, .vditor-ir") as HTMLElement | null;
  }, []);

  // 清除搜索高亮
  const clearHighlights = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // 移除所有搜索高亮标记
    const marks = container.querySelectorAll("mark[data-search-highlight]");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || "");
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    });
    // 移除搜索高亮样式类
    const contentEl = getContentElement();
    if (contentEl) {
      contentEl.classList.remove("search-highlight-active");
    }
  }, [getContentElement]);

  // 高亮所有匹配项 - 使用 innerHTML 替换方式
  const highlightAll = useCallback((query: string, caseSensitive: boolean) => {
    clearHighlights();
    const container = containerRef.current;
    if (!container || !query) return 0;

    // 获取编辑器内容
    const vditor = vditorRef.current;
    if (!vditor) return 0;

    const text = vditor.getValue();
    if (!text) return 0;

    // 计算匹配数量
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(escapedQuery, flags);
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;

    if (count === 0) return 0;

    // 使用 Vditor 的搜索功能（如果可用）
    try {
      // Vditor 3.x 可能有 search 方法
      if (typeof (vditor as any).search === "function") {
        (vditor as any).search(query, caseSensitive);
        return count;
      }
    } catch {
      // 忽略错误，使用备用方案
    }

    // 备用方案：在 DOM 中高亮
    const contentEl = container.querySelector(".vditor-ir") as HTMLElement | null;
    if (!contentEl) return 0;

    // 收集所有文本节点
    const walker = document.createTreeWalker(
      contentEl,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent) {
        textNodes.push(node);
      }
    }

    // 第一遍：计算总匹配数并收集匹配位置
    let totalCount = 0;
    const nodeMatches: Array<{ node: Text; matches: RegExpExecArray[] }> = [];

    for (const textNode of textNodes) {
      const nodeText = textNode.textContent || "";
      regex.lastIndex = 0;
      if (!regex.test(nodeText)) continue;
      regex.lastIndex = 0;

      const matches: RegExpExecArray[] = [];
      let match: RegExpExecArray | null;
      while ((match = regex.exec(nodeText)) !== null) {
        matches.push(match);
        totalCount++;
      }
      nodeMatches.push({ node: textNode, matches });
    }

    // 第二遍：从后往前处理 DOM，但使用正确的顺序索引
    let globalIndex = 1;
    for (const { node: textNode, matches } of nodeMatches) {
      const nodeText = textNode.textContent || "";
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;

      for (const match of matches) {
        // 匹配前的文本
        if (match.index > lastIdx) {
          fragment.appendChild(document.createTextNode(nodeText.slice(lastIdx, match.index)));
        }
        // 高亮的匹配文本
        const mark = document.createElement("mark");
        mark.setAttribute("data-search-highlight", "");
        mark.setAttribute("data-search-index", String(globalIndex++));
        mark.style.background = "rgba(56, 108, 95, 0.3)";
        mark.style.color = "inherit";
        mark.style.borderRadius = "2px";
        mark.style.padding = "0 1px";
        mark.textContent = match[0];
        fragment.appendChild(mark);
        lastIdx = match.index + match[0].length;
      }

      // 剩余文本
      if (lastIdx < nodeText.length) {
        fragment.appendChild(document.createTextNode(nodeText.slice(lastIdx)));
      }

      // 替换原始文本节点
      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    }

    return totalCount;
  }, [clearHighlights]);

  // 滚动到指定索引的匹配项并高亮当前项
  const scrollToMatch = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;

    // 移除之前的当前高亮样式
    const prevActive = container.querySelector("mark[data-search-active]") as HTMLElement | null;
    if (prevActive) {
      prevActive.removeAttribute("data-search-active");
      prevActive.style.outline = "";
      prevActive.style.boxShadow = "";
      prevActive.style.background = "rgba(56, 108, 95, 0.3)";
    }

    // 找到当前索引的匹配项
    const mark = container.querySelector(`mark[data-search-index="${index}"]`) as HTMLElement | null;
    if (mark) {
      mark.setAttribute("data-search-active", "");
      mark.style.outline = "2px solid var(--accent, #386c5f)";
      mark.style.boxShadow = "0 0 0 2px var(--accent-soft, rgba(56, 108, 95, 0.3))";
      mark.style.background = "rgba(56, 108, 95, 0.5)";
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleSearch = useCallback((query: string, caseSensitive: boolean) => {
    if (!query) {
      clearHighlights();
      searchMatchesRef.current = [];
      return 0;
    }
    const count = highlightAll(query, caseSensitive);
    searchMatchesRef.current = Array.from({ length: count }, () => ({ start: 0, end: 0 }));
    searchIdxRef.current = 1;
    if (count > 0) {
      scrollToMatch(1);
    }
    return count;
  }, [highlightAll, clearHighlights, scrollToMatch]);

  const handleNext = useCallback(() => {
    const matches = searchMatchesRef.current;
    if (matches.length === 0) return;
    searchIdxRef.current = (searchIdxRef.current % matches.length) + 1;
    scrollToMatch(searchIdxRef.current);
  }, [scrollToMatch]);

  const handlePrev = useCallback(() => {
    const matches = searchMatchesRef.current;
    if (matches.length === 0) return;
    searchIdxRef.current = ((searchIdxRef.current - 2 + matches.length) % matches.length) + 1;
    scrollToMatch(searchIdxRef.current);
  }, [scrollToMatch]);

  const handleReplace = useCallback((replacement: string) => {
    const container = containerRef.current;
    if (!container) return;
    const activeMark = container.querySelector("mark[data-search-active]") as HTMLElement | null;
    if (activeMark && activeMark.parentNode) {
      const parent = activeMark.parentNode;
      const textNode = document.createTextNode(replacement);
      parent.replaceChild(textNode, activeMark);
      parent.normalize();

      // 替换后，找到下一个匹配项并激活它
      const remainingMarks = container.querySelectorAll("mark[data-search-highlight]");
      if (remainingMarks.length > 0) {
        // 找到当前索引的下一个
        const currentIdx = searchIdxRef.current;
        const nextMark = container.querySelector(`mark[data-search-index="${currentIdx}"]`) as HTMLElement | null
          || container.querySelector(`mark[data-search-index="${currentIdx + 1}"]`) as HTMLElement | null
          || remainingMarks[0] as HTMLElement;

        if (nextMark) {
          nextMark.setAttribute("data-search-active", "");
          nextMark.style.outline = "2px solid var(--accent, #386c5f)";
          nextMark.style.boxShadow = "0 0 0 2px var(--accent-soft, rgba(56, 108, 95, 0.3))";
          nextMark.style.background = "rgba(56, 108, 95, 0.5)";
          nextMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }
  }, []);

  const handleReplaceAll = useCallback((replacement: string) => {
    const container = containerRef.current;
    if (!container) return;
    const marks = container.querySelectorAll("mark[data-search-highlight]");
    marks.forEach((mark) => {
      if (mark.parentNode) {
        const textNode = document.createTextNode(replacement);
        mark.parentNode.replaceChild(textNode, mark);
      }
    });
    container.normalize();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (mod && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => vditorRef.current?.getValue() ?? initialValueRef.current,
    setValue: (value: string) => {
      const vditor = vditorRef.current;
      if (!vditor) return;
      skipNextValueRef.current = value;
      vditor.setValue(value);
    },
    focus: () => {
      vditorRef.current?.focus();
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    readyRef.current = false;
    containerRef.current.dataset.vditorReady = "false";

    // 跟踪 Ctrl/Meta 按键状态，用于 Vditor link.click 回调
    let modifierHeld = false;
    const onKey = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) modifierHeld = true; };
    const onKeyUp = () => { modifierHeld = false; };
    const notifyCurrentValue = () => {
      const value = vditorRef.current?.getValue();
      if (value === undefined) return;
      if (skipNextValueRef.current !== null) {
        if (value === skipNextValueRef.current) {
          skipNextValueRef.current = null;
          return;
        }
        skipNextValueRef.current = null;
      }
      onChangeRef.current(value);
    };
    const onPaste = () => {
      window.setTimeout(notifyCurrentValue, 0);
      window.setTimeout(notifyCurrentValue, 50);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    containerRef.current.addEventListener("paste", onPaste, true);

    const vditor = new Vditor(containerRef.current, {
      cdn: VDITOR_CDN,
      lang: VDITOR_LANG,
      mode: "ir",
      height: "100%",
      theme: theme === "dark" ? "dark" : "classic",
      icon: "ant",
      cache: { enable: false },
      value: initialValue,
      input: (value) => {
        if (skipNextValueRef.current !== null) {
          if (value === skipNextValueRef.current) {
            skipNextValueRef.current = null;
            return;
          }
          skipNextValueRef.current = null;
        }
        onChangeRef.current(value);
      },
      placeholder,
      toolbar: normalizeToolbar(
        toolbar ?? DEFAULT_TOOLBAR,
        createTableToolbarItem((rows, cols) => {
          vditorRef.current?.insertValue(buildTableMarkdown(rows, cols), true);
          vditorRef.current?.focus();
        }),
      ) as never,
      preview: {
        theme: { current: theme === "dark" ? "dark" : "light" },
      },
      counter: { enable: true },
      link: {
        isOpen: false,
        click: (element) => {
          if (!element || !modifierHeld) return;
          const url = element.getAttribute("href") || element.textContent;
          if (url) {
            openUrl(url).catch(() => {});
          }
        },
      },
      after: () => {
        readyRef.current = true;
        if (containerRef.current) {
          containerRef.current.dataset.vditorReady = "true";
        }
        const latestValue = initialValueRef.current;
        if (vditor.getValue() !== latestValue) {
          skipNextValueRef.current = latestValue;
          vditor.setValue(latestValue);
        }
      },
    });

    vditorRef.current = vditor;
    (containerRef.current as HTMLDivElement & { __vditor?: Vditor }).__vditor = vditor;

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      containerRef.current?.removeEventListener("paste", onPaste, true);
      try {
        if (readyRef.current) {
          vditor.destroy();
        }
      } catch { /* ignore */ }
      closeActiveTablePanel?.();
      if (containerRef.current) {
        delete (containerRef.current as HTMLDivElement & { __vditor?: Vditor }).__vditor;
        containerRef.current.dataset.vditorReady = "false";
      }
      vditorRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external content changes
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    const current = vditor.getValue();
    if (current !== initialValue) {
      skipNextValueRef.current = initialValue;
      vditor.setValue(initialValue);
    }
  }, [initialValue]);

  // Sync theme changes
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    try {
      vditor.setTheme(
        theme === "dark" ? "dark" : "classic",
        theme === "dark" ? "dark" : "light",
        theme === "dark" ? "dark" : "classic",
      );
    } catch { /* ignore if not initialized yet */ }
  }, [theme]);

  // 关闭搜索面板并清除高亮
  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    clearHighlights();
    searchMatchesRef.current = [];
    searchIdxRef.current = 0;
  }, [clearHighlights]);

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="vditor-container" />
      {searchOpen && (
        <SearchReplaceBar
          onSearch={handleSearch}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
          onNext={handleNext}
          onPrev={handlePrev}
          onClose={handleCloseSearch}
        />
      )}
    </div>
  );
});
