import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlignLeft, ListTree, MessageCircle, SlidersHorizontal, Tags } from "lucide-react";
import { useSettingsStore, clampDockPanelWidth, DOCK_PANEL_WIDTH_MIN, DOCK_PANEL_WIDTH_MAX } from "../../stores/settingsStore";

export type DockPanelKey = "properties" | "tags" | "summary" | "outline" | "chat";

const DOCK_TABS: { key: DockPanelKey; icon: typeof Tags }[] = [
  { key: "properties", icon: SlidersHorizontal },
  { key: "tags", icon: Tags },
  { key: "summary", icon: AlignLeft },
  { key: "outline", icon: ListTree },
  { key: "chat", icon: MessageCircle },
];

/** 图标列宽度 + 间隙（面板宽度之外的 dock 占位） */
export const DOCK_RAIL_WIDTH = 48;

interface EditorDockProps {
  /** page = 编辑器页（fixed，避开 TopBar）；drawer = 阅读抽屉内（absolute，避开抽屉 header） */
  variant: "page" | "drawer";
  panels: Partial<Record<DockPanelKey, ReactNode>>;
}

/**
 * 应用级右侧 dock：面板在左、图标列贴应用右缘（VSCode 式）。
 * 显隐由 showDocumentOutline 设置控制；激活面板由 editorSidebarTab 记忆；
 * 面板宽度可拖拽左缘调整（dockPanelWidth 持久化）。
 */
export function EditorDock({ variant, panels }: EditorDockProps) {
  const { t } = useTranslation(["document"]);
  const activeTab = useSettingsStore((s) => s.settings.editorSidebarTab);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const visible = useSettingsStore((s) => s.settings.showDocumentOutline);
  const savedWidth = useSettingsStore((s) => s.settings.dockPanelWidth);

  // 拖拽中用本地值实时预览，松手才写入设置持久化，避免逐帧触发保存。
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const panelWidth = dragWidth ?? savedWidth;

  const handleResizePointerMove = useCallback((event: PointerEvent) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const delta = drag.startX - event.clientX;
    setDragWidth(clampDockPanelWidth(drag.startWidth + delta));
  }, []);

  const handleResizePointerUp = useCallback(() => {
    dragStateRef.current = null;
    document.body.classList.remove("select-none", "cursor-col-resize");
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", handleResizePointerUp);
    setDragWidth((width) => {
      if (width !== null) updateSetting("dockPanelWidth", width);
      return null;
    });
  }, [handleResizePointerMove, updateSetting]);

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", handleResizePointerUp);
      document.body.classList.remove("select-none", "cursor-col-resize");
    };
  }, [handleResizePointerMove, handleResizePointerUp]);

  function handleResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragStateRef.current = { startX: event.clientX, startWidth: panelWidth };
    document.body.classList.add("select-none", "cursor-col-resize");
    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", handleResizePointerUp);
  }

  if (!visible) return null;

  const positionClass = variant === "page"
    // bottom-7 避开底部状态栏（时间/网络状态等，h-7）
    ? "fixed right-0 top-14 bottom-7 z-40"
    : "absolute right-0 top-[3.75rem] bottom-0 z-40";

  return (
    <div
      className={`hidden lg:flex ${positionClass} flex-row border-l border-[var(--line)] bg-[var(--app-bg)]`}
      data-testid="editor-dock"
    >
      <div
        className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-[var(--accent)]"
        role="separator"
        aria-orientation="vertical"
        aria-label={t("document:sidebar.resize")}
        data-testid="editor-dock-resize-handle"
        title={t("document:sidebar.resize")}
        onPointerDown={handleResizePointerDown}
      />
      <div
        className="flex min-w-0 flex-col p-2"
        style={{ width: `${panelWidth}px` }}
        data-testid="editor-dock-panel"
      >
        {panels[activeTab as DockPanelKey] ?? null}
      </div>
      <nav
        className="flex w-11 shrink-0 flex-col gap-1 p-1"
        role="tablist"
        aria-label={t("document:sidebar.tabsLabel")}
      >
        {DOCK_TABS.map(({ key, icon: TabIcon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`editor-sidebar-tab-${key}`}
              title={t(`document:sidebar.tabs.${key}`)}
              aria-label={t(`document:sidebar.tabs.${key}`)}
              onClick={() => updateSetting("editorSidebarTab", key)}
            >
              <TabIcon className="h-4 w-4" />
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export { DOCK_PANEL_WIDTH_MIN, DOCK_PANEL_WIDTH_MAX };
