import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { VDITOR_CDN, getVditorLang } from "../../utils/vditorConfig";
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
  lang?: "zh_CN" | "en_US";
  toolbar?: string[];
  placeholder?: string;
}

export interface VditorEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  scrollToHeading: (index: number) => void;
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

type TablePanelCloseRef = { current: (() => void) | null };

function clampTableSize(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(200, Math.floor(value)));
}

const TABLE_I18N = {
  zh_CN: {
    title: "插入表格",
    editTitle: "调整表格",
    row: "行",
    col: "列",
    alignment: "当前列对齐",
    left: "左对齐",
    center: "居中",
    right: "右对齐",
    cancel: "取消",
    insert: "插入",
    apply: "应用",
    colName: "列",
  },
  en_US: {
    title: "Insert Table",
    editTitle: "Edit Table",
    row: "Rows",
    col: "Cols",
    alignment: "Current column alignment",
    left: "Left",
    center: "Center",
    right: "Right",
    cancel: "Cancel",
    insert: "Insert",
    apply: "Apply",
    colName: "Col",
  },
} as const;

function buildTableMarkdown(rowsInput: number, colsInput: number, lang: "zh_CN" | "en_US" = "zh_CN") {
  const rows = clampTableSize(rowsInput);
  const cols = clampTableSize(colsInput);
  const t = TABLE_I18N[lang];
  const headers = Array.from({ length: cols }, (_, index) => `${t.colName} ${index + 1}`);
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

function getEditorRange(vditor: Vditor): Range | null {
  const editorState = vditor.vditor[vditor.vditor.currentMode];
  const selection = window.getSelection();
  if (editorState?.element && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (editorState.element === range.startContainer || editorState.element.contains(range.startContainer)) {
      return range.cloneRange();
    }
  }
  return editorState?.range?.cloneRange() ?? null;
}

function getClosestElement(node: Node | null, selector: string): Element | null {
  const element = node instanceof Element ? node : node?.parentElement;
  return element?.closest(selector) ?? null;
}

function getTableFromRange(range: Range | null): HTMLTableElement | null {
  return getClosestElement(range?.startContainer ?? null, "table") as HTMLTableElement | null;
}

function getCellFromRange(range: Range | null): HTMLTableCellElement | null {
  return getClosestElement(range?.startContainer ?? null, "td, th") as HTMLTableCellElement | null;
}

function updateTableToolbarTip(trigger: HTMLElement, vditor: Vditor, lang: "zh_CN" | "en_US") {
  const t = TABLE_I18N[lang];
  const tip = getTableFromRange(getEditorRange(vditor)) ? t.editTitle : t.title;
  trigger.setAttribute("aria-label", tip);
}

function restoreEditorRange(vditor: Vditor, range: Range | null) {
  const editorState = vditor.vditor[vditor.vditor.currentMode];
  if (!editorState?.element || !range || !editorState.element.contains(range.startContainer)) {
    vditor.focus();
    return null;
  }

  const restoredRange = range.cloneRange();
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(restoredRange);
  editorState.range = restoredRange;
  return restoredRange;
}

function notifyTableChanged(vditor: Vditor) {
  vditor.vditor.undo?.addToUndoStack(vditor.vditor);
  vditor.vditor.options.input?.(vditor.getValue());
}

function setTableColumnAlignment(table: HTMLTableElement, range: Range | null, alignment: "left" | "center" | "right") {
  const cell = getCellFromRange(range);
  const columnIndex = cell?.cellIndex ?? 0;
  Array.from(table.rows).forEach((row) => {
    row.cells[columnIndex]?.setAttribute("align", alignment);
  });
}

function createTableCell(tagName: "td" | "th", alignment?: string) {
  const cell = document.createElement(tagName);
  cell.textContent = " ";
  if (alignment) cell.setAttribute("align", alignment);
  return cell;
}

function resizeTable(table: HTMLTableElement, rowsInput: number, colsInput: number, range: Range | null) {
  const rows = clampTableSize(rowsInput);
  const cols = clampTableSize(colsInput);
  const originalRows = Array.from(table.rows);
  const originalColumns = originalRows[0]?.cells.length ?? 0;
  if (originalRows.length === 0 || originalColumns === 0) return range;

  const currentCell = getCellFromRange(range);
  const currentRow = currentCell?.parentElement as HTMLTableRowElement | null;
  const targetRowIndex = Math.min(currentRow?.rowIndex ?? 0, rows - 1);
  const targetColumnIndex = Math.min(currentCell?.cellIndex ?? 0, cols - 1);
  const columnAlignments = Array.from(originalRows[0].cells).map((cell) => cell.getAttribute("align") || undefined);

  originalRows.forEach((row, rowIndex) => {
    while (row.cells.length > cols) row.deleteCell(row.cells.length - 1);
    while (row.cells.length < cols) {
      const columnIndex = row.cells.length;
      row.appendChild(createTableCell(rowIndex === 0 ? "th" : "td", columnAlignments[columnIndex]));
    }
  });

  let body = table.tBodies[0];
  while (table.rows.length > rows) {
    table.rows[table.rows.length - 1].remove();
  }
  if (rows > 1) {
    if (!body) {
      body = document.createElement("tbody");
      table.appendChild(body);
    }
    while (table.rows.length < rows) {
      const row = document.createElement("tr");
      for (let columnIndex = 0; columnIndex < cols; columnIndex++) {
        row.appendChild(createTableCell("td", columnAlignments[columnIndex]));
      }
      body.appendChild(row);
    }
  } else if (body) {
    body.remove();
  }

  const targetCell = table.rows[targetRowIndex]?.cells[targetColumnIndex];
  if (!targetCell) return range;
  const nextRange = document.createRange();
  nextRange.selectNodeContents(targetCell);
  nextRange.collapse(false);
  return nextRange;
}

function showTableSizePanel(
  event: Event,
  onInsert: (rows: number, cols: number) => void,
  lang: "zh_CN" | "en_US" = "zh_CN",
  vditor: Vditor,
  activePanelRef: TablePanelCloseRef,
) {
  event.preventDefault();
  event.stopPropagation();
  activePanelRef.current?.();

  const t = TABLE_I18N[lang];
  const savedRange = getEditorRange(vditor);
  const table = getTableFromRange(savedRange);
  const isEditing = Boolean(table);

  const trigger = event.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : event.target instanceof HTMLElement
      ? event.target.closest<HTMLElement>("button, .vditor-toolbar__item")
      : null;
  if (trigger) trigger.setAttribute("aria-label", isEditing ? t.editTitle : t.title);
  const panel = document.createElement("div");
  panel.className = "quantanote-vditor-table-panel";

  const title = document.createElement("div");
  title.className = "quantanote-vditor-table-panel__title";
  title.textContent = isEditing ? t.editTitle : t.title;

  const form = document.createElement("form");
  form.className = "quantanote-vditor-table-panel__form";

  const rowLabel = document.createElement("label");
  rowLabel.textContent = t.row;
  const rowInput = document.createElement("input");
  rowInput.type = "number";
  rowInput.min = "1";
  rowInput.step = "1";
  rowInput.value = String(table?.rows.length ?? 3);
  rowLabel.appendChild(rowInput);

  const colLabel = document.createElement("label");
  colLabel.textContent = t.col;
  const colInput = document.createElement("input");
  colInput.type = "number";
  colInput.min = "1";
  colInput.step = "1";
  colInput.value = String(table?.rows[0]?.cells.length ?? 3);
  colLabel.appendChild(colInput);

  const actions = document.createElement("div");
  actions.className = "quantanote-vditor-table-panel__actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.textContent = t.cancel;

  const insertButton = document.createElement("button");
  insertButton.type = "submit";
  insertButton.textContent = isEditing ? t.apply : t.insert;
  insertButton.className = "primary";

  if (table) {
    const alignmentGroup = document.createElement("div");
    alignmentGroup.className = "quantanote-vditor-table-panel__alignment";
    const alignmentLabel = document.createElement("div");
    alignmentLabel.className = "quantanote-vditor-table-panel__alignment-label";
    alignmentLabel.textContent = t.alignment;
    const alignmentActions = document.createElement("div");
    alignmentActions.className = "quantanote-vditor-table-panel__alignment-actions";
    ([
      ["left", t.left],
      ["center", t.center],
      ["right", t.right],
    ] as const).forEach(([alignment, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.tableAlign = alignment;
      button.addEventListener("click", () => {
        setTableColumnAlignment(table, savedRange, alignment);
        restoreEditorRange(vditor, savedRange);
        notifyTableChanged(vditor);
      });
      alignmentActions.appendChild(button);
    });
    alignmentGroup.append(alignmentLabel, alignmentActions);
    form.append(alignmentGroup);
  }

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
    if (activatePanelTimeout !== null) {
      window.clearTimeout(activatePanelTimeout);
      activatePanelTimeout = null;
    }
    document.removeEventListener("pointerdown", handleOutsidePointer);
    document.removeEventListener("keydown", handleKeydown);
    panel.remove();
    if (activePanelRef.current === closePanel) {
      activePanelRef.current = null;
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
    if (table) {
      const nextRange = resizeTable(table, Number(rowInput.value), Number(colInput.value), savedRange);
      restoreEditorRange(vditor, nextRange);
      notifyTableChanged(vditor);
    } else {
      restoreEditorRange(vditor, savedRange);
      onInsert(Number(rowInput.value), Number(colInput.value));
    }
    closePanel();
  });
  cancelButton.addEventListener("click", closePanel);

  let activatePanelTimeout: number | null = window.setTimeout(() => {
    activatePanelTimeout = null;
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleKeydown);
    rowInput.focus();
    rowInput.select();
  });

  activePanelRef.current = closePanel;
}

function createTableToolbarItem(
  insertTable: (rows: number, cols: number) => void,
  getVditor: () => Vditor | null,
  activePanelRef: TablePanelCloseRef,
  lang: "zh_CN" | "en_US" = "zh_CN",
): VditorToolbarItem {
  return {
    name: "quantanote-table",
    icon: TABLE_ICON,
    tip: TABLE_I18N[lang].title,
    click: (event) => {
      const vditor = getVditor();
      if (vditor) showTableSizePanel(event, insertTable, lang, vditor, activePanelRef);
    },
  };
}

function normalizeToolbar(items: string[], tableItem: VditorToolbarItem): VditorToolbarItem[] {
  return items.map((item) => item === "table" ? tableItem : item);
}

export const VditorEditor = forwardRef<VditorEditorHandle, VditorEditorProps>(function VditorEditor({
  initialValue,
  onChange,
  theme = "dark",
  lang,
  toolbar,
  placeholder,
}, ref) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("editor:placeholder");
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(initialValue);
  const skipNextValueRef = useRef<string | null>(null);
  // 最近一次通过 onChange 上报给父组件的值;同步外部内容时用于识别"回声",
  // 避免父组件把编辑器自己发出的值传回来时触发 setValue 导致光标被重置到文档开头
  const lastEmittedRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const activeTablePanelRef = useRef<TablePanelCloseRef["current"]>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchMatchesRef = useRef<Array<{ start: number; end: number }>>([]);
  const searchIdxRef = useRef(0);
  const searchQueryRef = useRef("");
  const searchCaseSensitiveRef = useRef(false);

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

  // 高亮所有匹配项 - 使用 DOM API 安全替换
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

    // 在编辑区 DOM 中高亮，保证替换操作能定位到真实匹配节点。
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

  const commitEditorValue = useCallback((value: string) => {
    const vditor = vditorRef.current;
    if (!vditor) return false;

    skipNextValueRef.current = value;
    try {
      vditor.setValue(value);
      lastEmittedRef.current = value;
      onChangeRef.current(value);
      return true;
    } finally {
      skipNextValueRef.current = null;
    }
  }, []);

  const handleSearch = useCallback((query: string, caseSensitive: boolean) => {
    searchQueryRef.current = query;
    searchCaseSensitiveRef.current = caseSensitive;
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
    const vditor = vditorRef.current;
    if (!container || !vditor) return;
    const activeMark = container.querySelector("mark[data-search-active]") as HTMLElement | null;
    if (activeMark && activeMark.parentNode) {
      const parent = activeMark.parentNode;
      const textNode = document.createTextNode(replacement);
      parent.replaceChild(textNode, activeMark);
      parent.normalize();

      if (!commitEditorValue(vditor.getValue())) return;
      clearHighlights();
      const nextCount = highlightAll(searchQueryRef.current, searchCaseSensitiveRef.current);
      searchMatchesRef.current = Array.from({ length: nextCount }, () => ({ start: 0, end: 0 }));
      searchIdxRef.current = Math.min(searchIdxRef.current, Math.max(nextCount, 1));
      if (nextCount > 0) scrollToMatch(searchIdxRef.current);
    }
  }, [clearHighlights, commitEditorValue, highlightAll, scrollToMatch]);

  const handleReplaceAll = useCallback((replacement: string) => {
    const container = containerRef.current;
    const vditor = vditorRef.current;
    if (!container || !vditor) return;
    const marks = container.querySelectorAll("mark[data-search-highlight]");
    marks.forEach((mark) => {
      if (mark.parentNode) {
        const textNode = document.createTextNode(replacement);
        mark.parentNode.replaceChild(textNode, mark);
      }
    });
    container.normalize();
    if (marks.length > 0) {
      commitEditorValue(vditor.getValue());
      clearHighlights();
      searchMatchesRef.current = [];
    }
  }, [clearHighlights, commitEditorValue]);

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
    scrollToHeading: (index: number) => {
      const headings = containerRef.current?.querySelectorAll<HTMLElement>(
        ".vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6",
      );
      const heading = headings?.[index];
      heading?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;

    // 语言切换前保存当前内容，重建后恢复
    const currentVditor = vditorRef.current;
    if (currentVditor && readyRef.current) {
      const currentContent = currentVditor.getValue();
      if (currentContent) {
        initialValueRef.current = currentContent;
      }
    }

    readyRef.current = false;
    containerRef.current.dataset.vditorReady = "false";

    // 跟踪 Ctrl/Meta 按键状态，用于 Vditor link.click 回调
    let modifierHeld = false;
    let disposed = false;
    let removeTableToolbarTipListeners = () => {};
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
      lastEmittedRef.current = value;
      onChangeRef.current(value);
    };
    const onPaste = () => {
      window.setTimeout(notifyCurrentValue, 0);
      window.setTimeout(notifyCurrentValue, 50);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    containerRef.current.addEventListener("paste", onPaste, true);

    const resolvedLang = lang ?? getVditorLang();
    const vditor = new Vditor(containerRef.current, {
      cdn: VDITOR_CDN,
      lang: resolvedLang,
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
        lastEmittedRef.current = value;
        onChangeRef.current(value);
      },
      placeholder: resolvedPlaceholder,
      toolbar: normalizeToolbar(
        toolbar ?? DEFAULT_TOOLBAR,
        createTableToolbarItem((rows, cols) => {
          vditorRef.current?.insertMD(buildTableMarkdown(rows, cols, resolvedLang));
          vditorRef.current?.focus();
        }, () => vditorRef.current, activeTablePanelRef, resolvedLang),
      ) as never,
      preview: {
        theme: { current: theme === "dark" ? "dark" : "light" },
        // vditor 默认关闭 mark 语法(==高亮==),显式开启以支持 GFM 扩展
        markdown: { mark: true },
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
        if (disposed) return;
        readyRef.current = true;
        if (containerRef.current) {
          containerRef.current.dataset.vditorReady = "true";
        }
        const tableToolbarButton = containerRef.current?.querySelector<HTMLElement>("button[data-type='quantanote-table']");
        if (tableToolbarButton) {
          const refreshTableToolbarTip = () => updateTableToolbarTip(tableToolbarButton, vditor, resolvedLang);
          ["mouseenter", "focus", "mousedown"].forEach((eventName) => {
            tableToolbarButton.addEventListener(eventName, refreshTableToolbarTip);
          });
          removeTableToolbarTipListeners = () => {
            ["mouseenter", "focus", "mousedown"].forEach((eventName) => {
              tableToolbarButton.removeEventListener(eventName, refreshTableToolbarTip);
            });
          };
        }
        const latestValue = initialValueRef.current;
        if (vditor.getValue() !== latestValue) {
          skipNextValueRef.current = latestValue;
          lastEmittedRef.current = latestValue;
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
      removeTableToolbarTipListeners();
      disposed = true;
      activeTablePanelRef.current?.();
      activeTablePanelRef.current = null;
      try {
        vditor.destroy();
      } catch { /* ignore */ }
      if (containerRef.current) {
        delete (containerRef.current as HTMLDivElement & { __vditor?: Vditor }).__vditor;
        containerRef.current.dataset.vditorReady = "false";
      }
      vditorRef.current = null;
      readyRef.current = false;
    };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external content changes
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    // initialValue 就是本组件最近上报的值,说明是父组件回传的回声而非外部变更;
    // 此时执行 setValue 会重建编辑区并把光标重置到文档开头(打字中尤其明显)
    if (initialValue === lastEmittedRef.current) return;
    const current = vditor.getValue();
    if (current !== initialValue) {
      skipNextValueRef.current = initialValue;
      lastEmittedRef.current = initialValue;
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
