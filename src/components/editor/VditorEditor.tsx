import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { AlignCenter, AlignLeft, AlignRight, Copy, Download, ExternalLink, RefreshCw, Replace, X } from "lucide-react";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useTranslation } from "react-i18next";
import { VDITOR_CDN, getVditorLang } from "../../utils/vditorConfig";
import type { AttachmentDto } from "../../stores/attachmentStore";
import { exportAttachment } from "../../services/tauriCommands";
import {
  buildAttachmentMarkdown,
  getAttachmentAssetUrl,
  getAttachmentImageOptions,
  getAttachmentImageStyle,
  getAttachmentReference,
  isImageAttachment,
  isImagePath,
  normalizeAttachmentReferences,
  resolveAttachmentReferences,
  type AttachmentImageAlignment,
  withAttachmentImageOptions,
} from "../../utils/markdownAttachments";
import { SearchReplaceBar } from "./SearchReplaceBar";
import { useToastStore } from "../../stores/toastStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { shortcutMatches } from "../../utils/shortcutRegistry";

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
  attachments?: readonly AttachmentDto[];
  onAddAttachment?: (path: string) => Promise<AttachmentDto | null>;
  onAddAttachmentData?: (filename: string, mimeType: string, data: string) => Promise<AttachmentDto | null>;
  onOpenAttachments?: () => void;
}

interface AttachmentInsertItem {
  attachment: AttachmentDto;
  asImage: boolean;
}

interface ImageEditorState {
  attachmentId?: string;
  sourceBase: string;
  alt: string;
  title: string;
  width: string;
  align: AttachmentImageAlignment;
  left: number;
  top: number;
}

interface ImageErrorState {
  image: HTMLImageElement;
  filename: string;
  left: number;
  top: number;
}

function imageSourceBase(source: string) {
  return source.split("#", 1)[0].replace(/[\\]/g, "/").toLowerCase();
}

function findAttachmentForImage(
  image: HTMLImageElement,
  attachments: readonly AttachmentDto[],
) {
  const source = imageSourceBase(image.getAttribute("src") || "");
  return attachments.find((attachment) => {
    const assetSource = imageSourceBase(getAttachmentAssetUrl(attachment));
    return source === assetSource || source.includes(attachment.id.toLowerCase());
  });
}

function getImageOverlayPosition(image: HTMLImageElement, host: HTMLElement, width: number) {
  const imageRect = image.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const maxLeft = Math.max(8, hostRect.width - width - 8);
  const left = Math.max(8, Math.min(imageRect.left - hostRect.left, maxLeft));
  const top = imageRect.bottom - hostRect.top + 8;
  return { left, top };
}

function getImageWidthValue(value: string) {
  const width = Number(value);
  return Number.isFinite(width) && width >= 40 && width <= 4000 ? Math.round(width) : undefined;
}

interface MarkdownImageMatch {
  full: string;
  alt: string;
  source: string;
  index: number;
}

function escapeMarkdownImageLabel(value: string) {
  return value.replace(/[\\\[\]]/g, "\\$&");
}

function getMarkdownImageMatches(value: string): MarkdownImageMatch[] {
  const pattern = /!\[((?:\\.|[^\]\\])*)\]\((?:<([^>\r\n]+)>|([^\s)\r\n]+))(?:\s+(?:"[^"]*"|'[^']*'))?\)/g;
  return Array.from(value.matchAll(pattern)).map((match) => ({
    full: match[0],
    alt: match[1],
    source: match[2] ?? match[3],
    index: match.index ?? -1,
  }));
}

function findMarkdownImageMatch(
  value: string,
  image: HTMLImageElement,
  container: HTMLElement,
) {
  const matches = getMarkdownImageMatches(value);
  const images = Array.from(container.querySelectorAll<HTMLImageElement>('.vditor-ir img:not(.emoji)'));
  const imageIndex = images.indexOf(image);
  const indexedMatch = imageIndex >= 0 ? matches[imageIndex] : undefined;
  if (indexedMatch) return indexedMatch;

  const sourceBase = imageSourceBase(image.getAttribute("src") || "");
  const alt = image.getAttribute("alt") || "";
  return matches.find((match) => {
    return imageSourceBase(match.source) === sourceBase || match.alt === alt;
  });
}

function updateMarkdownImage(
  value: string,
  image: HTMLImageElement,
  container: HTMLElement,
  source: string,
  alt: string,
  title: string,
) {
  const match = findMarkdownImageMatch(value, image, container);
  if (!match || match.index < 0) return null;

  const safeAlt = escapeMarkdownImageLabel(alt.trim());
  const safeTitle = title.trim().replace(/[\\"]/g, "\\$&");
  const nextImage = `![${safeAlt}](${source}${safeTitle ? ` "${safeTitle}"` : ""})`;
  return `${value.slice(0, match.index)}${nextImage}${value.slice(match.index + match.full.length)}`;
}

function applyImagePresentation(image: HTMLImageElement, options: { width?: number; align?: AttachmentImageAlignment }) {
  const style = getAttachmentImageStyle(options);
  image.style.width = style.width ?? "";
  image.style.maxWidth = style.maxWidth ?? "";
  image.style.display = style.display ?? "";
  image.style.marginLeft = style.marginLeft ?? "";
  image.style.marginRight = style.marginRight ?? "";
}

function refreshImagePresentation(container: HTMLElement) {
  container.querySelectorAll<HTMLImageElement>("img")
    .forEach((image) => applyImagePresentation(image, getAttachmentImageOptions(image.getAttribute("src") || "")));
}

export interface VditorEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  saveSelection: () => void;
  scrollToHeading: (index: number) => void;
  insertAttachment: (attachment: AttachmentDto, asImage?: boolean) => void;
  openImagePicker: () => void;
}

const DEFAULT_TOOLBAR = [
  "headings", "bold", "italic", "strike", "emoji", "|",
  "list", "ordered-list", "check", "outdent", "indent", "|",
  "quote", "code", "inline-code", "|",
  "link", "table", "line", "quantanote-image", "quantanote-attachment", "|",
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

const IMAGE_ICON = `
<svg class="quantanote-image-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="3.5" y="4.5" width="17" height="15" rx="2.5"></rect>
  <circle cx="8.5" cy="9" r="1.4"></circle>
  <path d="m4.5 17 4.7-4.7a1.5 1.5 0 0 1 2.1 0l2.2 2.2 1.5-1.5a1.5 1.5 0 0 1 2.1 0l2.4 2.4"></path>
</svg>`;

const ATTACHMENT_ICON = `
<svg class="quantanote-attachment-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="m13.5 6.5-6.9 6.9a3.4 3.4 0 0 0 4.8 4.8l7-7a4.8 4.8 0 0 0-6.8-6.8l-7.1 7.1a6.2 6.2 0 0 0 8.8 8.8l6.1-6.1"></path>
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

function getLiveEditorRange(vditor: Vditor): Range | null {
  const editorState = vditor.vditor[vditor.vditor.currentMode];
  const selection = window.getSelection();
  if (editorState?.element && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (editorState.element === range.startContainer || editorState.element.contains(range.startContainer)) {
      return range.cloneRange();
    }
  }
  return null;
}

function getEditorRange(vditor: Vditor): Range | null {
  const editorState = vditor.vditor[vditor.vditor.currentMode];
  const liveRange = getLiveEditorRange(vditor);
  if (liveRange) return liveRange;
  return editorState?.range?.cloneRange() ?? null;
}

interface EditorSelectionBookmark {
  start: number;
  end: number;
  range?: Range;
}

/**
 * DOM Range 保存的是具体的 DOM 节点。编辑器被 setValue 或附件解析刷新后，
 * 这些节点可能已经脱离当前编辑器，继续使用它会让 Vditor 回退到文档开头。
 * 用可见文本偏移保存选区，插入前再根据当前 DOM 重建 Range，可以跨越这类刷新。
 */
function getEditorSelectionBookmark(vditor: Vditor): EditorSelectionBookmark | null {
  const editorState = vditor.vditor[vditor.vditor.currentMode];
  const range = getEditorRange(vditor);
  const editor = editorState?.element;
  if (!editor || !range || !editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;

  const preSelectionRange = range.cloneRange();
  if (editor.childNodes[0]) {
    preSelectionRange.setStart(editor, 0);
  } else {
    preSelectionRange.selectNodeContents(editor);
  }
  preSelectionRange.setEnd(range.startContainer, range.startOffset);

  return {
    start: Math.max(0, preSelectionRange.toString().length),
    end: Math.max(0, preSelectionRange.toString().length + range.toString().length),
    range: range.cloneRange(),
  };
}

function setRangeBoundary(range: Range, boundary: "start" | "end", node: Node, offset: number) {
  if (boundary === "start") range.setStart(node, offset);
  else range.setEnd(node, offset);
}

function restoreEditorSelection(vditor: Vditor, bookmark: EditorSelectionBookmark | null | undefined) {
  const editorState = vditor.vditor[vditor.vditor.currentMode];
  const editor = editorState?.element;
  if (!editor) {
    vditor.focus();
    return null;
  }

  // 模态框只会让浏览器选区失焦，并不会改变编辑器 DOM。优先恢复原始
  // Range，这样可以保留段落、换行和 Vditor 标记节点之间的准确位置。
  if (bookmark?.range
    && editor.contains(bookmark.range.startContainer)
    && editor.contains(bookmark.range.endContainer)) {
    const restoredRange = bookmark.range.cloneRange();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(restoredRange);
    editorState.range = restoredRange;
    return restoredRange;
  }

  // 没有可用书签时插入到正文末尾，避免浏览器/Vditor 的默认 focus 行为
  // 把内容插到文档开头。正常入口都会带有文本偏移书签，因此这里只是
  // 最后的安全兜底。
  if (!bookmark) {
    const endRange = document.createRange();
    endRange.selectNodeContents(editor);
    endRange.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(endRange);
    editorState.range = endRange;
    return endRange;
  }

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  const totalLength = textNodes.reduce((total, node) => total + node.data.length, 0);
  const start = Math.min(Math.max(0, bookmark.start), totalLength);
  const end = Math.min(Math.max(start, bookmark.end), totalLength);
  const restoredRange = document.createRange();

  const setBoundaryByOffset = (boundary: "start" | "end", offset: number) => {
    if (textNodes.length === 0) {
      setRangeBoundary(restoredRange, boundary, editor, offset === 0 ? 0 : editor.childNodes.length);
      return;
    }

    let charIndex = 0;
    for (const textNode of textNodes) {
      const nextCharIndex = charIndex + textNode.data.length;
      if (offset <= nextCharIndex) {
        setRangeBoundary(restoredRange, boundary, textNode, offset - charIndex);
        return;
      }
      charIndex = nextCharIndex;
    }

    const lastTextNode = textNodes[textNodes.length - 1];
    setRangeBoundary(restoredRange, boundary, lastTextNode, lastTextNode.data.length);
  };

  setBoundaryByOffset("start", start);
  setBoundaryByOffset("end", end);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(restoredRange);
  editorState.range = restoredRange;
  return restoredRange;
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
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

function normalizeToolbar(
  items: string[],
  tableItem: VditorToolbarItem,
  imageItem?: VditorToolbarItem,
  attachmentItem?: VditorToolbarItem,
): VditorToolbarItem[] {
  return items.flatMap((item) => {
    if (item === "table") return [tableItem];
    if (item === "quantanote-image") return imageItem ? [imageItem] : [];
    if (item === "quantanote-attachment") return attachmentItem ? [attachmentItem] : [];
    return [item];
  });
}

const VditorEditorBase = forwardRef<VditorEditorHandle, VditorEditorProps>(function VditorEditor({
  initialValue,
  onChange,
  theme = "dark",
  lang,
  toolbar,
  placeholder,
  attachments = [],
  onAddAttachment,
  onAddAttachmentData,
  onOpenAttachments,
}, ref) {
  const { t } = useTranslation();
  const editorFindShortcut = useSettingsStore((state) => state.settings.shortcuts["editor.find"]);
  const editorReplaceShortcut = useSettingsStore((state) => state.settings.shortcuts["editor.replace"]);
  const resolvedPlaceholder = placeholder ?? t("editor:placeholder");
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(initialValue);
  const attachmentsRef = useRef<readonly AttachmentDto[]>(attachments);
  const onAddAttachmentRef = useRef(onAddAttachment);
  const onAddAttachmentDataRef = useRef(onAddAttachmentData);
  const onOpenAttachmentsRef = useRef(onOpenAttachments);
  const savedInsertRangeRef = useRef<EditorSelectionBookmark | null>(null);
  const lastEditorRangeRef = useRef<EditorSelectionBookmark | null>(null);
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
  const [dragActive, setDragActive] = useState(false);
  const selectedImageRef = useRef<HTMLImageElement | null>(null);
  const imageErrorRef = useRef<ImageErrorState | null>(null);
  const [imageEditor, setImageEditor] = useState<ImageEditorState | null>(null);
  const [imageError, setImageError] = useState<ImageErrorState | null>(null);
  imageErrorRef.current = imageError;

  const getSelectedImage = useCallback((state: ImageEditorState | null = imageEditor) => {
    const container = containerRef.current;
    const selected = selectedImageRef.current;
    if (container && selected && container.contains(selected)) return selected;
    if (!container || !state) return null;
    const candidates = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
    return candidates.find((image) => {
      if (state.attachmentId) {
        return findAttachmentForImage(image, attachmentsRef.current)?.id === state.attachmentId;
      }
      return imageSourceBase(image.getAttribute("src") || "") === state.sourceBase;
    }) ?? null;
  }, [imageEditor]);

  onChangeRef.current = onChange;
  initialValueRef.current = initialValue;
  attachmentsRef.current = attachments;
  onAddAttachmentRef.current = onAddAttachment;
  onAddAttachmentDataRef.current = onAddAttachmentData;
  onOpenAttachmentsRef.current = onOpenAttachments;

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

    const vditor = vditorRef.current;
    if (!vditor) return 0;
    if (!vditor.getValue()) return 0;

    // 搜索以编辑器实际渲染出来的文本为准，而不是直接搜索 Markdown 源码。
    // 这样不会把链接地址、图片语法或加粗标记误算成可见匹配项。
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(escapedQuery, flags);

    // 在编辑区 DOM 中高亮，保证替换操作能定位到真实匹配节点。
    const contentEl = container.querySelector(".vditor-ir") as HTMLElement | null;
    if (!contentEl) return 0;

    // 收集所有文本节点
    const walker = document.createTreeWalker(
      contentEl,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          // IR mode renders Markdown syntax (including link URLs) as helper
          // marker nodes. They are visible in the editing surface but are not
          // document text, so searching them would count/replace Markdown
          // syntax and link destinations unexpectedly.
          return node.parentElement?.closest(".vditor-ir__marker")
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      },
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

  const insertAttachment = useCallback((
    attachment: AttachmentDto | readonly AttachmentInsertItem[],
    asImage?: boolean,
    bookmark?: EditorSelectionBookmark | null,
  ) => {
    const vditor = vditorRef.current;
    if (!vditor) return;
    const insertionItems: readonly AttachmentInsertItem[] = Array.isArray(attachment)
      ? attachment as readonly AttachmentInsertItem[]
      : [{ attachment: attachment as AttachmentDto, asImage: asImage ?? isImageAttachment(attachment as AttachmentDto) }];
    const insertionBookmark = bookmark
      ?? savedInsertRangeRef.current
      ?? getEditorSelectionBookmark(vditor)
      ?? lastEditorRangeRef.current;
    savedInsertRangeRef.current = null;
    restoreEditorSelection(vditor, insertionBookmark);
    const markdown = insertionItems
      .map(({ attachment: itemAttachment, asImage: itemAsImage }) => resolveAttachmentReferences(
        buildAttachmentMarkdown(itemAttachment, itemAsImage),
        attachmentsRef.current,
      ))
      .join("");
    if (!markdown) return;
    vditor.insertMD(markdown);
    const nextBookmark = getEditorSelectionBookmark(vditor);
    // insertMD 会先把浏览器选区移动到插入内容之后；先保存这个位置，
    // 再恢复编辑器焦点，避免 focus() 让下一张附件回到文档开头。
    vditor.focus();
    if (nextBookmark) {
      savedInsertRangeRef.current = nextBookmark;
      lastEditorRangeRef.current = nextBookmark;
    }
  }, []);

  const insertAttachmentBatch = useCallback((items: readonly AttachmentInsertItem[], bookmark: EditorSelectionBookmark | null) => {
    if (items.length === 0) return;
    const vditor = vditorRef.current;
    if (!vditor) return;
    const baseBookmark = bookmark
      ?? getEditorSelectionBookmark(vditor)
      ?? lastEditorRangeRef.current;
    // Vditor 的 insertMD 对连续块节点只保留最后一个节点。逐个插入时从后
    // 往前使用同一个文本偏移，最终正文仍保持用户选择的正向顺序。
    // 多个插入之间不复用上一次的 Range，避免 DOM 变更后 Range 脱离编辑器。
    const fixedBookmark = items.length > 1 && baseBookmark
      ? { start: baseBookmark.start, end: baseBookmark.end }
      : baseBookmark;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      insertAttachment(item.attachment, item.asImage, fixedBookmark);
    }

    const lastItem = items[items.length - 1];
    const editorState = vditor?.vditor[vditor.vditor.currentMode];
    const editor = editorState?.element;
    if (!editor || !lastItem.asImage) return;

    // 每次单独插入都会把选区放到当前附件后面，倒序插入结束时它会停在
    // 第一张附件后。根据最后一张图片节点重建折叠 Range，保证用户继续输入
    // 时位于整批附件之后，而不是落到两张图片之间。
    const imageNodes = Array.from(editor.querySelectorAll<HTMLImageElement>("img"));
    const expectedPath = lastItem.attachment.file_path.replace(/[\\]/g, "/").toLowerCase();
    const lastImage = [...imageNodes].reverse().find((image) => {
      if (image.alt !== lastItem.attachment.filename) return false;
      const rawSource = image.getAttribute("src") || "";
      let source = rawSource;
      try {
        source = decodeURIComponent(rawSource);
      } catch {
        // 某些外部资源地址可能包含非法编码，继续使用原始地址匹配。
      }
      source = source.replace(/[\\]/g, "/").toLowerCase();
      return source.includes(lastItem.attachment.id.toLowerCase()) || source.endsWith(expectedPath);
    });
    const imageNode = lastImage?.closest<HTMLElement>(".vditor-ir__node[data-type='img']");
    if (!imageNode?.parentNode) return;

    const finalRange = document.createRange();
    finalRange.setStartAfter(imageNode);
    finalRange.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(finalRange);
    editorState.range = finalRange;
    const finalBookmark = getEditorSelectionBookmark(vditor);
    if (finalBookmark) {
      savedInsertRangeRef.current = finalBookmark;
      lastEditorRangeRef.current = finalBookmark;
    }
  }, [insertAttachment]);

  const commitEditorValue = useCallback((value: string, extraAttachments: readonly AttachmentDto[] = []) => {
    const vditor = vditorRef.current;
    if (!vditor) return false;

    const allAttachments = extraAttachments.length > 0
      ? [...attachmentsRef.current, ...extraAttachments]
      : attachmentsRef.current;
    const normalizedValue = normalizeAttachmentReferences(value, allAttachments);
    skipNextValueRef.current = normalizedValue;
    try {
      vditor.setValue(resolveAttachmentReferences(normalizedValue, allAttachments));
      lastEmittedRef.current = normalizedValue;
      onChangeRef.current(normalizedValue);
      return true;
    } finally {
      skipNextValueRef.current = null;
    }
  }, []);

  const closeImageEditor = useCallback(() => {
    selectedImageRef.current = null;
    setImageEditor(null);
  }, []);

  const applyImageEditor = useCallback(() => {
    const image = getSelectedImage(imageEditor);
    const editor = containerRef.current;
    const vditor = vditorRef.current;
    const state = imageEditor;
    if (!image || !editor?.contains(image) || !vditor || !state) {
      closeImageEditor();
      return;
    }

    const attachment = findAttachmentForImage(image, attachmentsRef.current);
    const options = {
      width: getImageWidthValue(state.width),
      align: state.align === "left" ? undefined : state.align,
    };
    const stableSource = attachment
      ? withAttachmentImageOptions(getAttachmentReference(attachment.id), options)
      : withAttachmentImageOptions(image.getAttribute("src") || "", options);
    const nextValue = updateMarkdownImage(
      vditor.getValue(),
      image,
      editor,
      stableSource,
      state.alt,
      state.title,
    );
    if (!nextValue || !commitEditorValue(nextValue, attachment ? [attachment] : [])) return;
    closeImageEditor();
  }, [closeImageEditor, commitEditorValue, getSelectedImage, imageEditor]);

  const replaceSelectedImage = useCallback(async () => {
    const image = getSelectedImage(imageEditor);
    const editor = containerRef.current;
    const add = onAddAttachmentRef.current;
    const state = imageEditor;
    if (!image || !editor?.contains(image) || !add || !state) return;

    const selected = await openDialog({
      multiple: false,
      title: t("editor:imageEditor.replace"),
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "tiff"] }],
    });
    if (!selected || Array.isArray(selected)) return;

    const replacement = await add(selected);
    const vditor = vditorRef.current;
    const currentImage = getSelectedImage(state);
    if (!replacement || !vditor || !currentImage || !editor.contains(currentImage)) return;

    const previous = findAttachmentForImage(currentImage, attachmentsRef.current);
    const options = {
      width: getImageWidthValue(state.width),
      align: state.align === "left" ? undefined : state.align,
    };
    const nextSource = withAttachmentImageOptions(getAttachmentReference(replacement.id), options);
    const nextAlt = state.alt.trim() && state.alt !== previous?.filename ? state.alt : replacement.filename;
    const nextValue = updateMarkdownImage(
      vditor.getValue(),
      currentImage,
      editor,
      nextSource,
      nextAlt,
      state.title,
    );
    if (!nextValue || !commitEditorValue(nextValue, [replacement])) return;
    closeImageEditor();
  }, [closeImageEditor, commitEditorValue, getSelectedImage, imageEditor, t]);

  const copySelectedImage = useCallback(async () => {
    const image = getSelectedImage();
    if (!image) return;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("当前环境不支持图片剪贴板");
      }
      const response = await fetch(image.currentSrc || image.src);
      if (!response.ok) throw new Error(`图片读取失败: ${response.status}`);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      useToastStore.getState().addToast("success", t("editor:imageEditor.copySuccess"));
    } catch (error) {
      console.error("Copy image failed:", error);
      useToastStore.getState().addToast("error", t("editor:imageEditor.copyFailed"));
    }
  }, [getSelectedImage, t]);

  const exportSelectedImage = useCallback(async () => {
    const image = getSelectedImage();
    if (!image) return;
    const attachment = findAttachmentForImage(image, attachmentsRef.current);
    if (!attachment) {
      const source = image.getAttribute("src");
      if (source) await openUrl(source).catch(() => {});
      return;
    }
    try {
      const destination = await saveDialog({
        title: t("editor:imageEditor.export"),
        defaultPath: attachment.filename,
      });
      if (!destination) return;
      await exportAttachment(attachment.file_path, destination);
      useToastStore.getState().addToast("success", t("editor:imageEditor.exportSuccess"));
    } catch (error) {
      console.error("Export image failed:", error);
      useToastStore.getState().addToast("error", t("editor:imageEditor.exportFailed"));
    }
  }, [getSelectedImage, t]);

  const openSelectedImage = useCallback(async () => {
    const image = getSelectedImage();
    if (!image) return;
    const attachment = findAttachmentForImage(image, attachmentsRef.current);
    if (attachment) {
      await openPath(attachment.file_path).catch(() => {});
      return;
    }
    const source = image.getAttribute("src");
    if (source) await openUrl(source).catch(() => {});
  }, [getSelectedImage]);

  const retryFailedImage = useCallback(() => {
    const errorState = imageError;
    const container = containerRef.current;
    if (!errorState || !container) {
      setImageError(null);
      return;
    }
    const failedImage = container.contains(errorState.image)
      ? errorState.image
      : Array.from(container.querySelectorAll<HTMLImageElement>(".vditor-ir img:not(.emoji)")).find(
        (image) => (image.getAttribute("alt") || "") === errorState.filename,
    );
    if (!failedImage) {
      setImageError(null);
      return;
    }
    const source = failedImage.getAttribute("src") || "";
    if (!source) return;
    setImageError(null);
    failedImage.removeAttribute("src");
    window.setTimeout(() => {
      if (container.contains(failedImage)) failedImage.setAttribute("src", source);
    });
  }, [imageError]);

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

  const insertAttachmentAtRange = useCallback((attachment: AttachmentDto, bookmark: EditorSelectionBookmark | null, asImage?: boolean) => {
    const vditor = vditorRef.current;
    if (!vditor) return;
    insertAttachment(attachment, asImage, bookmark);
  }, [insertAttachment]);

  const addAttachmentFromPath = useCallback(async (path: string, bookmark: EditorSelectionBookmark | null, forceImage = false, insert = true) => {
    const add = onAddAttachmentRef.current;
    if (!add) return null;
    const attachment = await add(path);
    if (attachment && insert) {
      insertAttachmentAtRange(attachment, bookmark, forceImage || isImageAttachment(attachment) || isImagePath(path));
    }
    return attachment;
  }, [insertAttachmentAtRange]);

  const addAttachmentFromFile = useCallback(async (file: File, bookmark: EditorSelectionBookmark | null, insert = true) => {
    const path = (file as File & { path?: string }).path;
    if (path && onAddAttachmentRef.current) {
      return addAttachmentFromPath(path, bookmark, file.type.startsWith("image/"), insert);
    }
    if (!file.type.startsWith("image/") || !onAddAttachmentDataRef.current) return null;
    const data = await fileToBase64(file);
    const attachment = await onAddAttachmentDataRef.current(
      file.name || `pasted-image-${Date.now()}.png`,
      file.type || "image/png",
      data,
    );
    if (attachment && insert) insertAttachmentAtRange(attachment, bookmark, true);
    return attachment;
  }, [addAttachmentFromPath, insertAttachmentAtRange]);

  const openAttachmentPicker = useCallback(async (asImage: boolean, multiple: boolean) => {
    const add = onAddAttachmentRef.current;
    const vditor = vditorRef.current;
    if (!add || !vditor) return;
    const insertionBookmark = savedInsertRangeRef.current ?? getEditorSelectionBookmark(vditor);
    const selected = await openDialog({
      multiple,
      title: asImage ? "Insert image" : "Insert attachment",
      filters: asImage ? [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "tiff"] }] : undefined,
    });
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
    const pending: AttachmentInsertItem[] = [];
    for (const path of paths) {
      const attachment = await add(path);
      if (attachment) pending.push({ attachment, asImage });
    }
    if (pending.length > 0) {
      insertAttachmentBatch(pending, insertionBookmark);
    }
  }, [insertAttachmentBatch]);

  const saveSelection = useCallback(() => {
    const vditor = vditorRef.current;
    if (!vditor) return;
    const bookmark = getEditorSelectionBookmark(vditor) ?? lastEditorRangeRef.current;
    if (bookmark) {
      // 按钮获得焦点后浏览器可能暂时没有编辑器选区，此时使用最近一次有效选区。
      savedInsertRangeRef.current = { ...bookmark };
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.target instanceof Node) || !containerRef.current?.contains(e.target)) return;
      if (shortcutMatches(e, editorFindShortcut)) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (shortcutMatches(e, editorReplaceShortcut)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    const handleEditorSearch = () => setSearchOpen(true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("quantanote-open-editor-search", handleEditorSearch);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("quantanote-open-editor-search", handleEditorSearch);
    };
  }, [editorFindShortcut, editorReplaceShortcut]);

  useImperativeHandle(ref, () => ({
    getValue: () => normalizeAttachmentReferences(
      vditorRef.current?.getValue() ?? initialValueRef.current,
      attachmentsRef.current,
    ),
    setValue: (value: string) => {
      const vditor = vditorRef.current;
      if (!vditor) return;
      const normalizedValue = normalizeAttachmentReferences(value, attachmentsRef.current);
      skipNextValueRef.current = normalizedValue;
      vditor.setValue(resolveAttachmentReferences(normalizedValue, attachmentsRef.current));
    },
    focus: () => {
      vditorRef.current?.focus();
    },
    saveSelection,
    openImagePicker: () => { void openAttachmentPicker(true, false).catch(() => {}); },
    scrollToHeading: (index: number) => {
      const headings = containerRef.current?.querySelectorAll<HTMLElement>(
        ".vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6",
      );
      const heading = headings?.[index];
      heading?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    insertAttachment,
  }), [insertAttachment, openAttachmentPicker, saveSelection]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const host = container.parentElement ?? container;

    const handleImageClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || target.classList.contains("emoji")) return;
      const options = getAttachmentImageOptions(target.getAttribute("src") || "");
      const attachment = findAttachmentForImage(target, attachmentsRef.current);
      const position = getImageOverlayPosition(target, host, 380);
      selectedImageRef.current = target;
      setImageError(null);
      setImageEditor({
        attachmentId: attachment?.id,
        sourceBase: imageSourceBase(target.getAttribute("src") || ""),
        alt: target.getAttribute("alt") || "",
        title: target.getAttribute("title") || "",
        width: options.width ? String(options.width) : "",
        align: options.align ?? "left",
        ...position,
      });
    };

    const handleImageLoad = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (imageErrorRef.current?.image === target) setImageError(null);
    };

    const handleImageError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || target.classList.contains("emoji")) return;
      const position = getImageOverlayPosition(target, host, 320);
      setImageEditor(null);
      setImageError({
        image: target,
        filename: target.getAttribute("alt") || t("editor:imageEditor.unknownImage"),
        ...position,
      });
    };

    container.addEventListener("click", handleImageClick);
    container.addEventListener("load", handleImageLoad, true);
    container.addEventListener("error", handleImageError, true);
    refreshImagePresentation(container);
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      refreshImagePresentation(container);
    });
    observer?.observe(container, { childList: true, subtree: true });
    return () => {
      observer?.disconnect();
      container.removeEventListener("click", handleImageClick);
      container.removeEventListener("load", handleImageLoad, true);
      container.removeEventListener("error", handleImageError, true);
      selectedImageRef.current = null;
    };
  }, [lang, t]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 语言切换前保存当前内容，重建后恢复
    const currentVditor = vditorRef.current;
    if (currentVditor && readyRef.current) {
      const currentContent = currentVditor.getValue();
      if (currentContent) {
        initialValueRef.current = currentContent;
      }
    }

    readyRef.current = false;
    container.dataset.vditorReady = "false";

    // Vditor loads Lute asynchronously. Give every lifecycle run its own host
    // node so a late initialization from a disposed instance cannot overwrite
    // the DOM owned by the current instance.
    const mount = document.createElement("div");
    mount.className = "quantanote-vditor-mount";
    mount.style.height = "100%";
    container.appendChild(mount);

    // 跟踪 Ctrl/Meta 按键状态，用于 Vditor link.click 回调
    let modifierHeld = false;
    let disposed = false;
    let removeTableToolbarTipListeners = () => {};
    let removeAttachmentToolbarSelectionListener = () => {};
    const onKey = (e: KeyboardEvent) => { if (e.ctrlKey || e.metaKey) modifierHeld = true; };
    const onKeyUp = () => { modifierHeld = false; };
    const notifyCurrentValue = () => {
      const value = vditorRef.current?.getValue();
      if (value === undefined) return;
      const normalizedValue = normalizeAttachmentReferences(value, attachmentsRef.current);
      if (skipNextValueRef.current !== null) {
        if (normalizedValue === skipNextValueRef.current) {
          skipNextValueRef.current = null;
          return;
        }
        skipNextValueRef.current = null;
      }
      lastEmittedRef.current = normalizedValue;
      onChangeRef.current(normalizedValue);
    };
    const onPaste = (event: ClipboardEvent) => {
      const imageFiles = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length > 0 && (onAddAttachmentDataRef.current || onAddAttachmentRef.current)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const currentEditor = vditorRef.current ?? vditor;
        void (async () => {
          const insertionBookmark = getEditorSelectionBookmark(currentEditor);
          const pending: AttachmentInsertItem[] = [];
          for (const imageFile of imageFiles) {
            const attachment = await addAttachmentFromFile(imageFile, null, false);
            if (attachment) pending.push({ attachment, asImage: true });
          }
          if (pending.length > 0) {
            insertAttachmentBatch(pending, insertionBookmark);
          }
        })().catch(() => {});
        return;
      }
      window.setTimeout(notifyCurrentValue, 0);
      window.setTimeout(notifyCurrentValue, 50);
    };
    const rememberEditorSelection = () => {
      const currentEditor = vditorRef.current;
      if (!currentEditor) return;
      const bookmark = getEditorSelectionBookmark(currentEditor);
      if (bookmark) lastEditorRangeRef.current = bookmark;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("selectionchange", rememberEditorSelection);
    container.addEventListener("paste", onPaste, true);

    const resolvedLang = lang ?? getVditorLang();
    const vditor = new Vditor(mount, {
      cdn: VDITOR_CDN,
      lang: resolvedLang,
      mode: "ir",
      height: "100%",
      theme: theme === "dark" ? "dark" : "classic",
      icon: "ant",
      cache: { enable: false },
      value: resolveAttachmentReferences(initialValue, attachmentsRef.current),
      input: (value) => {
        const normalizedValue = normalizeAttachmentReferences(value, attachmentsRef.current);
        if (skipNextValueRef.current !== null) {
          if (normalizedValue === skipNextValueRef.current) {
            skipNextValueRef.current = null;
            return;
          }
          skipNextValueRef.current = null;
        }
        lastEmittedRef.current = normalizedValue;
        onChangeRef.current(normalizedValue);
      },
      placeholder: resolvedPlaceholder,
      toolbar: normalizeToolbar(
        toolbar ?? DEFAULT_TOOLBAR,
        createTableToolbarItem((rows, cols) => {
          vditorRef.current?.insertMD(buildTableMarkdown(rows, cols, resolvedLang));
          vditorRef.current?.focus();
        }, () => vditorRef.current, activeTablePanelRef, resolvedLang),
        onAddAttachmentRef.current ? {
          name: "quantanote-image",
          icon: IMAGE_ICON,
          tip: t("editor:insertImage"),
          click: () => { void openAttachmentPicker(true, false).catch(() => {}); },
        } : undefined,
        onAddAttachmentRef.current ? {
          name: "quantanote-attachment",
          icon: ATTACHMENT_ICON,
          tip: t("editor:insertAttachment"),
          click: () => {
            if (onOpenAttachmentsRef.current) onOpenAttachmentsRef.current();
            else void openAttachmentPicker(false, true).catch(() => {});
          },
        } : undefined,
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
        if (disposed || vditorRef.current !== vditor || !container.contains(mount)) return;
        readyRef.current = true;
        container.dataset.vditorReady = "true";
        const tableToolbarButton = mount.querySelector<HTMLElement>("button[data-type='quantanote-table']");
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
        const attachmentToolbarButtons = mount.querySelectorAll<HTMLElement>(
          "button[data-type='quantanote-image'], button[data-type='quantanote-attachment']",
        );
        if (attachmentToolbarButtons.length > 0) {
          const saveAttachmentSelection = () => saveSelection();
          attachmentToolbarButtons.forEach((button) => ["pointerdown", "mousedown"].forEach((eventName) => {
            button.addEventListener(eventName, saveAttachmentSelection);
          }));
          removeAttachmentToolbarSelectionListener = () => {
            attachmentToolbarButtons.forEach((button) => ["pointerdown", "mousedown"].forEach((eventName) => {
              button.removeEventListener(eventName, saveAttachmentSelection);
            }));
          };
        }
        const latestValue = normalizeAttachmentReferences(initialValueRef.current, attachmentsRef.current);
        if (normalizeAttachmentReferences(vditor.getValue(), attachmentsRef.current) !== latestValue) {
          skipNextValueRef.current = latestValue;
          lastEmittedRef.current = latestValue;
          vditor.setValue(resolveAttachmentReferences(latestValue, attachmentsRef.current));
        }
      },
    });

    vditorRef.current = vditor;
    (containerRef.current as HTMLDivElement & { __vditor?: Vditor }).__vditor = vditor;

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("selectionchange", rememberEditorSelection);
      container.removeEventListener("paste", onPaste, true);
      removeTableToolbarTipListeners();
      removeAttachmentToolbarSelectionListener();
      disposed = true;
      activeTablePanelRef.current?.();
      activeTablePanelRef.current = null;
      try {
        if (vditor.vditor) vditor.destroy();
      } catch { /* ignore */ }
      mount.remove();
      const mountedEditor = container as HTMLDivElement & { __vditor?: Vditor };
      if (mountedEditor.__vditor === vditor) {
        delete mountedEditor.__vditor;
        container.dataset.vditorReady = "false";
      }
      if (vditorRef.current === vditor) {
        vditorRef.current = null;
        readyRef.current = false;
      }
    };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tauri 原生拖拽不会触发浏览器的 drop 事件，因此同时监听 Webview 拖拽事件；
  // 浏览器开发模式则走下面的 DOM fallback，可直接测试图片粘贴/拖拽体验。
  useEffect(() => {
    const container = containerRef.current;
    if (!container || (!onAddAttachmentRef.current && !onAddAttachmentDataRef.current)) return;

    const isInsideEditor = (position?: { x: number; y: number }) => {
      if (!position) return true;
      const rect = container.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const x = position.x / scale;
      const y = position.y / scale;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const handleTauriDrop = (event: { payload: { type: string; paths?: string[]; position?: { x: number; y: number } } }) => {
      const payload = event.payload;
      const inside = isInsideEditor(payload.position);
      if (payload.type === "enter" || payload.type === "over") {
        setDragActive(inside);
        return;
      }
      if (payload.type === "leave") {
        setDragActive(false);
        return;
      }
      if (payload.type !== "drop" || !inside) return;
      setDragActive(false);
      const currentEditor = vditorRef.current;
      if (!currentEditor) return;
      void (async () => {
        const insertionBookmark = getEditorSelectionBookmark(currentEditor);
        const pending: AttachmentInsertItem[] = [];
        for (const path of payload.paths ?? []) {
          const attachment = await addAttachmentFromPath(path, null, isImagePath(path), false);
          if (attachment) pending.push({ attachment, asImage: isImagePath(path) || isImageAttachment(attachment) });
        }
        if (pending.length > 0) {
          insertAttachmentBatch(pending, insertionBookmark);
        }
      })().catch(() => {});
    };

    const handleDomDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      setDragActive(true);
    };
    const handleDomDragLeave = (event: DragEvent) => {
      if (event.currentTarget === event.target) setDragActive(false);
    };
    const handleDomDrop = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      setDragActive(false);
      const currentEditor = vditorRef.current;
      if (!currentEditor) return;
      void (async () => {
        const insertionBookmark = getEditorSelectionBookmark(currentEditor);
        const pending: AttachmentInsertItem[] = [];
        for (const file of files) {
          const attachment = await addAttachmentFromFile(file, null, false);
          if (attachment) pending.push({ attachment, asImage: true });
        }
        if (pending.length > 0) {
          insertAttachmentBatch(pending, insertionBookmark);
        }
      })().catch(() => {});
    };

    container.addEventListener("dragover", handleDomDragOver);
    container.addEventListener("dragleave", handleDomDragLeave);
    container.addEventListener("drop", handleDomDrop);

    let disposed = false;
    let unlisten: (() => void) | undefined;
    try {
      getCurrentWebview().onDragDropEvent(handleTauriDrop).then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      }).catch(() => {});
    } catch {
      // 普通浏览器开发环境没有 Tauri runtime。
    }

    return () => {
      disposed = true;
      unlisten?.();
      container.removeEventListener("dragover", handleDomDragOver);
      container.removeEventListener("dragleave", handleDomDragLeave);
      container.removeEventListener("drop", handleDomDrop);
      setDragActive(false);
    };
  }, [addAttachmentFromFile, addAttachmentFromPath, attachments]);

  // Sync external content changes
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    const normalizedInitialValue = normalizeAttachmentReferences(initialValue, attachmentsRef.current);
    const resolvedInitialValue = resolveAttachmentReferences(normalizedInitialValue, attachmentsRef.current);
    const currentValue = vditor.getValue();
    const current = normalizeAttachmentReferences(currentValue, attachmentsRef.current);
    // initialValue 就是本组件最近上报的值,且编辑区已经显示了同一个解析后的值,
    // 说明是父组件回传的回声而非外部变更;此时不要 setValue,避免打字时光标跳回开头。
    // 如果附件列表刚刚异步加载,编辑区的原始值仍是 attachment://...,
    // 但解析后的值已经变成真实资源地址,必须继续向下执行一次刷新。
    if (initialValue === lastEmittedRef.current && currentValue === resolvedInitialValue) return;
    // The first Vditor render can happen before the asynchronous attachment
    // query completes. In that case both logical values are equal
    // (`attachment://...`), but the DOM still contains an unresolved source.
    // Compare the rendered value as well so the newly loaded attachment list
    // triggers one view-only re-resolution without changing saved Markdown.
    if (current !== normalizedInitialValue || currentValue !== resolvedInitialValue) {
      skipNextValueRef.current = normalizedInitialValue;
      lastEmittedRef.current = normalizedInitialValue;
      vditor.setValue(resolvedInitialValue);
    }
  }, [initialValue, attachments]);

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
      {imageEditor && (
        <div
          className="quantanote-image-editor-popover"
          data-testid="image-editor-popover"
          style={{ left: imageEditor.left, top: imageEditor.top }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="quantanote-image-editor-popover__header">
            <span>{t("editor:imageEditor.title")}</span>
            <button type="button" onClick={closeImageEditor} aria-label={t("editor:imageEditor.close")} title={t("editor:imageEditor.close")}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <label className="quantanote-image-editor-popover__field">
            <span>{t("editor:imageEditor.alt")}</span>
            <input
              value={imageEditor.alt}
              onChange={(event) => setImageEditor((current) => current ? { ...current, alt: event.target.value } : current)}
              placeholder={t("editor:imageEditor.altPlaceholder")}
              data-testid="image-editor-alt"
            />
          </label>
          <label className="quantanote-image-editor-popover__field">
            <span>{t("editor:imageEditor.imageTitle")}</span>
            <input
              value={imageEditor.title}
              onChange={(event) => setImageEditor((current) => current ? { ...current, title: event.target.value } : current)}
              placeholder={t("editor:imageEditor.titlePlaceholder")}
              data-testid="image-editor-title"
            />
          </label>
          <div className="quantanote-image-editor-popover__row">
            <label className="quantanote-image-editor-popover__field flex-1">
              <span>{t("editor:imageEditor.width")}</span>
              <input
                type="number"
                min="40"
                max="4000"
                step="1"
                value={imageEditor.width}
                onChange={(event) => setImageEditor((current) => current ? { ...current, width: event.target.value } : current)}
                placeholder={t("editor:imageEditor.autoSize")}
                data-testid="image-editor-width"
              />
            </label>
            <button
              className="quantanote-image-editor-popover__auto"
              type="button"
              onClick={() => setImageEditor((current) => current ? { ...current, width: "" } : current)}
            >
              {t("editor:imageEditor.autoSize")}
            </button>
          </div>
          <div className="quantanote-image-editor-popover__alignment">
            <span>{t("editor:imageEditor.alignment")}</span>
            <div className="flex items-center gap-1">
              {([
                ["left", AlignLeft, "editor:imageEditor.left"],
                ["center", AlignCenter, "editor:imageEditor.center"],
                ["right", AlignRight, "editor:imageEditor.right"],
              ] as const).map(([align, Icon, label]) => (
                <button
                  key={align}
                  className={imageEditor.align === align ? "is-active" : ""}
                  type="button"
                  aria-label={t(label)}
                  aria-pressed={imageEditor.align === align}
                  title={t(label)}
                  onClick={() => setImageEditor((current) => current ? { ...current, align } : current)}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
          <div className="quantanote-image-editor-popover__actions">
            <button type="button" onClick={() => void replaceSelectedImage()} disabled={!onAddAttachment}>
              <Replace className="h-3.5 w-3.5" />{t("editor:imageEditor.replace")}
            </button>
            <button type="button" onClick={() => void copySelectedImage()}>
              <Copy className="h-3.5 w-3.5" />{t("editor:imageEditor.copy")}
            </button>
            <button type="button" onClick={() => void exportSelectedImage()}>
              <Download className="h-3.5 w-3.5" />{t("editor:imageEditor.export")}
            </button>
            <button type="button" onClick={() => void openSelectedImage()}>
              <ExternalLink className="h-3.5 w-3.5" />{t("editor:imageEditor.openOriginal")}
            </button>
            <button className="is-primary" type="button" onClick={applyImageEditor} data-testid="image-editor-apply">
              {t("editor:imageEditor.apply")}
            </button>
          </div>
        </div>
      )}
      {imageError && (
        <div
          className="quantanote-image-error-popover"
          data-testid="image-load-error"
          style={{ left: imageError.left, top: imageError.top }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <span>{t("editor:imageEditor.loadFailed", { name: imageError.filename })}</span>
          <button type="button" onClick={retryFailedImage} data-testid="image-retry">
            <RefreshCw className="h-3.5 w-3.5" />{t("editor:imageEditor.retry")}
          </button>
          <button type="button" onClick={() => setImageError(null)} aria-label={t("editor:imageEditor.close")} data-testid="image-error-close">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {dragActive && (
        <div className="quantanote-editor-drop-overlay" data-testid="editor-drop-overlay" aria-hidden="true">
          <div className="quantanote-editor-drop-overlay__content">
            <span className="quantanote-editor-drop-overlay__icon">⌁</span>
            <span>{t("editor:dropFiles")}</span>
          </div>
        </div>
      )}
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

// Vditor owns the DOM inside its mount node. Avoid rebuilding that subtree when
// the document page re-renders for unrelated fields such as title or summary.
export const VditorEditor = memo(VditorEditorBase);
