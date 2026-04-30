import { Archive, Maximize2, Minus, MoreHorizontal, Search, Settings, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppPage } from "../../types";
import { Kbd } from "../common/Kbd";
import { useSettingsStore } from "../../stores/settingsStore";

const appWindow = getCurrentWindow();

interface TopBarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
}

const pageTitle: Record<AppPage, string> = {
  workspace: "工作台",
  library: "记录库",
  document: "编辑",
  settings: "设置",
};

export function TopBar({ currentPage, onNavigate, onOpenSearch }: TopBarProps) {
  const settings = useSettingsStore((s) => s.settings);

  function handleClose() {
    if (settings.closeKeepRunning || settings.minimizeToTray) {
      appWindow.minimize();
      return;
    }
    appWindow.close();
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--chrome)] px-3 [-webkit-app-region:drag]">
      <button
        className="rounded-lg px-2 py-1 text-left [-webkit-app-region:no-drag] hover:bg-[var(--hover)]"
        type="button"
        onClick={() => onNavigate("workspace")}
        title="返回记录"
      >
        <div className="text-sm font-semibold leading-none text-[var(--text)]">QuantaNote</div>
        <div className="mt-0.5 text-[11px] leading-none text-[var(--muted)]">{pageTitle[currentPage]}</div>
      </button>

      <button
        className={`hidden h-8 items-center gap-1.5 rounded-full px-3 text-sm transition [-webkit-app-region:no-drag] sm:inline-flex ${currentPage === "library" ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
        type="button"
        onClick={() => onNavigate("library")}
        title="打开记录库"
      >
        <Archive className="h-4 w-4" />
        记录库
      </button>

      <button
        className="ml-auto flex h-8 w-44 max-w-[36vw] items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] [-webkit-app-region:no-drag]"
        onClick={onOpenSearch}
        type="button"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">搜索</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <details className="group relative [-webkit-app-region:no-drag]">
        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden">
          <MoreHorizontal className="h-4 w-4" />
        </summary>
        <div className="absolute right-0 top-10 z-30 w-40 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            type="button"
            onClick={() => onNavigate("library")}
          >
            <Archive className="h-4 w-4" />
            记录库
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
            type="button"
            onClick={() => onNavigate("settings")}
          >
            <Settings className="h-4 w-4" />
            设置
          </button>
        </div>
      </details>

      <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" title="最小化" onClick={() => appWindow.minimize()}>
          <Minus className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" title="最大化" onClick={() => appWindow.toggleMaximize()}>
          <Maximize2 className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-500/12 hover:text-red-400" type="button" title="关闭" onClick={handleClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
