import { memo, useEffect, useState } from "react";
import { CheckCircle2, Database, Wifi, WifiOff } from "lucide-react";
import type { AppPage } from "../../types";

const PAGE_NAMES: Record<string, string> = {
  workspace: "工作台",
  library: "记录库",
  document: "文档编辑",
  settings: "设置",
};

interface StatusBarProps {
  currentPage: AppPage;
  itemCount?: number;
}

export const StatusBar = memo(function StatusBar({ currentPage, itemCount }: StatusBarProps) {
  const [time, setTime] = useState(() => formatTime());
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const timer = setInterval(() => setTime(formatTime()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleOnline() { setOnline(true); }
    function handleOffline() { setOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[var(--line)] bg-[var(--chrome)] px-3 text-xs text-[var(--muted)] select-none">
      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5" />
        <span>{PAGE_NAMES[currentPage] || currentPage}</span>
        {itemCount != null && <span>· {itemCount} 条记录</span>}
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      </div>
      <div className="flex items-center gap-3">
        <span>{time}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          {online ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              在线
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              离线
            </>
          )}
        </span>
        <span>·</span>
        <span>本地模式</span>
      </div>
    </footer>
  );
});

function formatTime(): string {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}
