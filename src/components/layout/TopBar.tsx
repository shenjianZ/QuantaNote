import { useEffect, useRef, useState } from "react";
import { Archive, Copy, Home, Minus, MoreHorizontal, Pin, Search, Settings, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppPage } from "../../types";
import { Kbd } from "../common/Kbd";
import { useSettingsStore } from "../../stores/settingsStore";

const appWindow = getCurrentWindow();
const ALWAYS_ON_TOP_STORAGE_KEY = "quantanote-always-on-top";

interface TopBarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
}

export function TopBar({ currentPage, onNavigate, onOpenSearch }: TopBarProps) {
  const settings = useSettingsStore((s) => s.settings);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const savedAlwaysOnTop = localStorage.getItem(ALWAYS_ON_TOP_STORAGE_KEY) === "true";
    setAlwaysOnTop(savedAlwaysOnTop);
    appWindow
      .setAlwaysOnTop(savedAlwaysOnTop)
      .then(() => appWindow.isAlwaysOnTop())
      .then(setAlwaysOnTop)
      .catch((error) => {
        console.warn("设置窗口置顶失败", error);
        appWindow.isAlwaysOnTop().then(setAlwaysOnTop).catch(() => {});
      });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function handleClose() {
    if (settings.closeKeepRunning || settings.minimizeToTray) {
      appWindow.minimize();
      return;
    }
    appWindow.close();
  }

  async function handleToggleAlwaysOnTop() {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, String(next));

    try {
      await appWindow.setAlwaysOnTop(next);
      const actual = await appWindow.isAlwaysOnTop();
      setAlwaysOnTop(actual);
      localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, String(actual));
    } catch {
      setAlwaysOnTop(!next);
      localStorage.setItem(ALWAYS_ON_TOP_STORAGE_KEY, String(!next));
    }
  }

  function navigateAndClose(page: AppPage) {
    setMenuOpen(false);
    onNavigate(page);
  }

  return (
    <header className="relative z-50 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--chrome)] px-3 [-webkit-app-region:drag]">
      <div className="shrink-0 px-1 text-left text-sm font-semibold text-[var(--text)]">QuantaNote</div>

      <button
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition [-webkit-app-region:no-drag] ${currentPage === "workspace" ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
        type="button"
        data-testid="nav-workspace"
        onClick={() => onNavigate("workspace")}
        title="打开工作台"
      >
        <Home className="h-4 w-4" />
        工作台
      </button>

      <button
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition [-webkit-app-region:no-drag] ${currentPage === "library" ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
        type="button"
        data-testid="nav-library"
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

      <div className="relative [-webkit-app-region:no-drag]" ref={menuRef}>
        <button
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${menuOpen ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-10 z-[60] w-40 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--popover)] p-1 shadow-xl" role="menu">
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose("workspace")}
            >
              <Home className="h-4 w-4" />
              工作台
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose("library")}
            >
              <Archive className="h-4 w-4" />
              记录库
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose("settings")}
            >
              <Settings className="h-4 w-4" />
              设置
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
        <button
          className={`grid h-8 w-8 place-items-center rounded-lg ${alwaysOnTop ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
          type="button"
          data-testid="window-pin"
          title={alwaysOnTop ? "窗口已置顶，点击取消" : "窗口置顶"}
          aria-pressed={alwaysOnTop}
          onClick={handleToggleAlwaysOnTop}
        >
          <Pin className={`h-4 w-4 ${alwaysOnTop ? "fill-current" : ""}`} />
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="window-minimize" title="最小化" onClick={() => appWindow.minimize()}>
          <Minus className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="window-maximize" title={isMaximized ? "恢复" : "全屏"} onClick={() => appWindow.toggleMaximize()}>
          {isMaximized ? <Copy className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-500/12 hover:text-red-400" type="button" data-testid="window-close" title="关闭" onClick={handleClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
