import { useEffect, useRef, useState } from "react";
import { Archive, Copy, Home, Minus, MoreHorizontal, Pin, Search, Settings, Square, User, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTranslation } from "react-i18next";
import type { AppPage } from "../../types";
import { Kbd } from "../common/Kbd";
import { useSettingsStore } from "../../stores/settingsStore";
import { useAppStore } from "../../stores/appStore";
import { useSyncStore } from "../../stores/syncStore";
import { useToastStore } from "../../stores/toastStore";
import i18n from "../../i18n";
import { SyncStatusIndicator } from "../sync/SyncStatusIndicator";

const appWindow = getCurrentWindow();

interface TopBarProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  onOpenSearch: () => void;
}

export function TopBar({ currentPage, onNavigate, onOpenSearch }: TopBarProps) {
  const { t } = useTranslation(["topbar", "common"]);
  const settings = useSettingsStore((s) => s.settings);
  const alwaysOnTop = useAppStore((s) => s.alwaysOnTop);
  const setAlwaysOnTop = useAppStore((s) => s.setAlwaysOnTop);
  const setSettingsSection = useAppStore((s) => s.setSettingsSection);
  const syncConfig = useSyncStore((s) => s.config);
  const isLoggedIn = Boolean(syncConfig.access_token && syncConfig.user_id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized);
    });
    return () => { unlisten.then((fn) => fn()); };
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

  function handleMinimize() {
    if (settings.minimizeToTray) {
      appWindow.hide();
      return;
    }
    appWindow.minimize();
  }

  function handleClose() {
    if (settings.closeKeepRunning) {
      appWindow.hide();
      return;
    }
    appWindow.close();
  }

  function handleToggleAlwaysOnTop() {
    void setAlwaysOnTop(!alwaysOnTop);
  }

  function navigateAndClose(page: AppPage) {
    setMenuOpen(false);
    onNavigate(page);
  }

  function handleAccountClick() {
    setMenuOpen(false);
    if (isLoggedIn) {
      onNavigate("profile");
    } else if (!syncConfig.server_url) {
      setSettingsSection(3);
      useToastStore.getState().addToast("info", i18n.t("topbar:accountServerUrlRequired"));
      onNavigate("settings");
    } else {
      onNavigate("profile");
    }
  }

  return (
    <header className="relative z-50 flex h-12 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--chrome)] px-3 [-webkit-app-region:drag]">
      <div className="shrink-0 px-1 text-left text-sm font-semibold text-[var(--text)]">QuantaNote</div>

      <button
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition [-webkit-app-region:no-drag] ${currentPage === "workspace" ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
        type="button"
        data-testid="nav-workspace"
        onClick={() => onNavigate("workspace")}
        title={t("topbar:openWorkspace")}
      >
        <Home className="h-4 w-4" />
        {t("topbar:workspace")}
      </button>

      <button
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition [-webkit-app-region:no-drag] ${currentPage === "library" ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
        type="button"
        data-testid="nav-library"
        onClick={() => onNavigate("library")}
        title={t("topbar:openLibrary")}
      >
        <Archive className="h-4 w-4" />
        {t("topbar:library")}
      </button>

      <SyncStatusIndicator />

      <button
        className="ml-auto flex h-8 w-44 max-w-[36vw] items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)] [-webkit-app-region:no-drag]"
        onClick={onOpenSearch}
        type="button"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{t("topbar:search")}</span>
        <span className="hidden items-center gap-1 sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="relative [-webkit-app-region:no-drag]" ref={menuRef}>
        <button
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${menuOpen ? "bg-[var(--field)] text-[var(--text)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
          type="button"
          aria-label={t("topbar:menu")}
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
              {t("topbar:workspace")}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose("library")}
            >
              <Archive className="h-4 w-4" />
              {t("topbar:library")}
            </button>
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              role="menuitem"
              onClick={() => navigateAndClose("settings")}
            >
              <Settings className="h-4 w-4" />
              {t("topbar:settings")}
            </button>
            <div className="my-1 h-px bg-[var(--line)]" />
            <button
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--hover)]"
              type="button"
              role="menuitem"
              onClick={handleAccountClick}
            >
              <User className="h-4 w-4" />
              {t("topbar:account")}
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
        <button
          className={`grid h-8 w-8 place-items-center rounded-lg ${alwaysOnTop ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
          type="button"
          data-testid="window-pin"
          title={alwaysOnTop ? t("topbar:unpin") : t("topbar:pin")}
          aria-pressed={alwaysOnTop}
          onClick={handleToggleAlwaysOnTop}
        >
          <Pin className={`h-4 w-4 ${alwaysOnTop ? "fill-current" : ""}`} />
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="window-minimize" aria-label={t("topbar:minimize")} title={t("topbar:minimize")} onClick={handleMinimize}>
          <Minus className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]" type="button" data-testid="window-maximize" aria-label={isMaximized ? t("topbar:restore") : t("topbar:maximize")} title={isMaximized ? t("topbar:restore") : t("topbar:maximize")} onClick={() => appWindow.toggleMaximize()}>
          {isMaximized ? <Copy className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
        <button className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-red-500/12 hover:text-red-400" type="button" data-testid="window-close" aria-label={t("common:buttons.close")} title={t("common:buttons.close")} onClick={handleClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
