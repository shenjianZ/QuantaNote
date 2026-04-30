import { Maximize2, Minus, Search, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Kbd } from "../common/Kbd";
import { useSettingsStore } from "../../stores/settingsStore";

const appWindow = getCurrentWindow();

interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  const settings = useSettingsStore((s) => s.settings);

  function handleClose() {
    if (settings.closeKeepRunning || settings.minimizeToTray) {
      appWindow.minimize();
      return;
    }
    appWindow.close();
  }

  return (
    <header className="topbar">
      <button className="search-trigger" onClick={onOpenSearch} type="button">
        <Search />
        <span className="search-text">搜索...</span>
        <span className="search-keys">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="window-tools">
        <button type="button" title="最小化" onClick={() => appWindow.minimize()}>
          <Minus />
        </button>
        <button type="button" title="最大化" onClick={() => appWindow.toggleMaximize()}>
          <Maximize2 />
        </button>
        <button type="button" title="关闭" onClick={handleClose}>
          <X />
        </button>
      </div>
    </header>
  );
}
