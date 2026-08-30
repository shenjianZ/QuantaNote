import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSyncStore } from "../../stores/syncStore";

interface SyncStatusIndicatorProps {
    onClick?: () => void;
}

export function SyncStatusIndicator({ onClick }: SyncStatusIndicatorProps) {
    const { t } = useTranslation(["sync", "common"]);
    const { config, state, triggerSync } = useSyncStore();

    if (!config.enabled || !config.authenticated) {
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
        <Cloud className="h-4 w-4 text-green-400" />
    ) : state.status === "error" ? (
        <CloudOff className="h-4 w-4 text-red-400" />
    ) : (
        <Cloud className="h-4 w-4 text-[var(--muted)]" />
    );

    const tooltip = isSyncing
        ? `${t("statusTooltip.syncing")}${state.progress ? `: ${state.progress.phase}` : ""}`
        : state.status === "completed"
          ? t("statusTooltip.completed", { time: state.last_sync_at ? new Date(state.last_sync_at).toLocaleString() : t("statusTooltip.justNow") })
          : state.status === "error"
            ? t("statusTooltip.error", { message: state.last_error || t("syncError") })
            : t("statusTooltip.default");

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
