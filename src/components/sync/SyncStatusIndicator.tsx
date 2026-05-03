import { Cloud, CloudOff, Loader2, CloudCog } from "lucide-react";
import { useSyncStore } from "../../stores/syncStore";

interface SyncStatusIndicatorProps {
    onClick?: () => void;
}

export function SyncStatusIndicator({ onClick }: SyncStatusIndicatorProps) {
    const { config, state, triggerSync } = useSyncStore();

    if (!config.enabled || !config.access_token) {
        return null;
    }

    const isSyncing =
        state.status === "preparing" ||
        state.status === "pushing" ||
        state.status === "pulling" ||
        state.status === "syncing_attachments";

    const statusIcon = isSyncing ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
    ) : state.status === "completed" ? (
        <CloudCog className="h-4 w-4 text-green-400" />
    ) : state.status === "error" ? (
        <CloudOff className="h-4 w-4 text-red-400" />
    ) : (
        <Cloud className="h-4 w-4 text-[var(--muted)]" />
    );

    const tooltip = isSyncing
        ? `同步中${state.progress ? `: ${state.progress.phase}` : ""}`
        : state.status === "completed"
          ? `上次同步: ${state.last_sync_at ? new Date(state.last_sync_at).toLocaleString() : "刚刚"}`
          : state.status === "error"
            ? `同步错误: ${state.last_error || "未知错误"}`
            : "点击同步";

    async function handleClick() {
        if (isSyncing) return;
        if (onClick) {
            onClick();
        } else {
            try {
                await triggerSync();
            } catch {
                // error handled in store
            }
        }
    }

    return (
        <button
            className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] [-webkit-app-region:no-drag]"
            type="button"
            title={tooltip}
            onClick={handleClick}
            disabled={isSyncing}
        >
            {statusIcon}
        </button>
    );
}
