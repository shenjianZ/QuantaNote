import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import { VDITOR_CDN, VDITOR_LANG } from "../../utils/vditorConfig";

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
  const skipNextChange = useRef(false);
  const readyRef = useRef(false);

  onChangeRef.current = onChange;
  initialValueRef.current = initialValue;

  useImperativeHandle(ref, () => ({
    getValue: () => vditorRef.current?.getValue() ?? initialValueRef.current,
    setValue: (value: string) => {
      const vditor = vditorRef.current;
      if (!vditor) return;
      skipNextChange.current = true;
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
        if (skipNextChange.current) {
          skipNextChange.current = false;
          return;
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
      after: () => {
        readyRef.current = true;
        if (containerRef.current) {
          containerRef.current.dataset.vditorReady = "true";
        }
        const latestValue = initialValueRef.current;
        if (vditor.getValue() !== latestValue) {
          skipNextChange.current = true;
          vditor.setValue(latestValue);
        }
      },
    });

    vditorRef.current = vditor;
    (containerRef.current as HTMLDivElement & { __vditor?: Vditor }).__vditor = vditor;

    return () => {
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
      skipNextChange.current = true;
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

  return <div ref={containerRef} className="vditor-container" />;
});
