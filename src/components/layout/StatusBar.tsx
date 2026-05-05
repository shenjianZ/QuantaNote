import { memo, useEffect, useState } from "react";
import { CheckCircle2, CloudOff, Database, Loader2, Wifi, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppPage } from "../../types";
import { useSyncStore } from "../../stores/syncStore";

interface StatusBarProps {
  currentPage: AppPage;
  itemCount?: number;
}

export const StatusBar = memo(function StatusBar({ currentPage, itemCount }: StatusBarProps) {
  const { t } = useTranslation(["statusbar", "common", "sync"]);
  const [time, setTime] = useState(() => formatTime());
  const [online, setOnline] = useState(() => navigator.onLine);
  const { config, state } = useSyncStore();

  const syncActive = config.enabled && Boolean(config.access_token);
  const isSyncing =
    state.status === "preparing" ||
    state.status === "pushing" ||
    state.status === "pulling" ||
    state.status === "syncing_attachments";

  const PAGE_NAMES: Record<string, string> = {
    workspace: t("statusbar:workspace"),
    library: t("statusbar:library"),
    document: t("statusbar:document"),
    settings: t("statusbar:settings"),
  };

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
        {itemCount != null && <span>· {t("statusbar:recordCount", { count: itemCount })}</span>}
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      </div>
      <div className="flex items-center gap-3">
        <span>{time}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          {online ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" />
              {t("common:status.online")}
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              {t("common:status.offline")}
            </>
          )}
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          {syncActive ? (
            isSyncing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                {t("sync:syncing")}
              </>
            ) : state.status === "error" ? (
              <>
                <CloudOff className="h-3 w-3 text-red-400" />
                {t("sync:syncError")}
              </>
            ) : state.last_sync_at ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {t("sync:lastSync", { time: new Date(state.last_sync_at).toLocaleTimeString() })}
              </>
            ) : (
              t("sync:idle")
            )
          ) : (
            t("common:status.localMode")
          )}
        </span>
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
