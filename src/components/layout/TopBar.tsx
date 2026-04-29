import { Bell, Cloud, Maximize2, Minus, Search, X } from "lucide-react";
import { Kbd } from "../common/Kbd";

interface TopBarProps {
  onOpenSearch: () => void;
}

export function TopBar({ onOpenSearch }: TopBarProps) {
  return (
    <header className="topbar">
      <button className="search-trigger" onClick={onOpenSearch} type="button">
        <Search size={22} />
        <span>搜索或记录任何东西...</span>
        <span className="search-keys">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="window-tools">
        <button type="button" title="通知">
          <Bell size={20} />
          <i />
        </button>
        <button type="button" title="云同步">
          <Cloud size={22} />
        </button>
        <button type="button" title="最小化">
          <Minus size={18} />
        </button>
        <button type="button" title="最大化">
          <Maximize2 size={17} />
        </button>
        <button type="button" title="关闭">
          <X size={20} />
        </button>
      </div>
    </header>
  );
}
