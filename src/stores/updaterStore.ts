import { create } from "zustand";
import { getVersion } from "@tauri-apps/api/app";
import { checkForAppUpdate, downloadAppUpdate, installAppUpdate } from "../lib/updater";
import type { UpdateState } from "../lib/update-types";
import type { Update, DownloadEvent } from "@tauri-apps/plugin-updater";
import { useSettingsStore } from "./settingsStore";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

function classifyUpdateError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();
    if (lower.includes("dns") || lower.includes("getaddr") || lower.includes("resolve")) {
        return i18n.t("settings:updateErrorNetwork");
    }
    if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("connection refused")) {
        return i18n.t("settings:updateErrorUnreachable");
    }
    if (
        lower.includes("did not respond with a successful status code") ||
        lower.includes("404") ||
        lower.includes("not found")
    ) {
        return i18n.t("settings:updateErrorNoRelease");
    }
    if (lower.includes("cert") || lower.includes("tls") || lower.includes("ssl")) {
        return i18n.t("settings:updateErrorNetwork");
    }
    return i18n.t("settings:updateErrorUnknown");
}

type UpdaterState = {
    updateState: UpdateState;
    pendingUpdate: Update | null;
    checkForUpdates: () => Promise<void>;
    downloadUpdate: () => Promise<void>;
    installUpdate: () => Promise<void>;
    startAutoUpdateCheck: () => void;
};

const INITIAL_STATE: UpdateState = {
    status: "idle",
    currentVersion: "...",
    latestVersion: null,
    downloadedVersion: null,
    contentLength: null,
    downloadedBytes: 0,
    error: null,
    availableUpdate: null,
};

let hasRunStartupCheck = false;

async function fetchAppVersion(): Promise<string> {
    try {
        return await getVersion();
    } catch {
        return "...";
    }
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
    updateState: { ...INITIAL_STATE },
    pendingUpdate: null,

    checkForUpdates: async () => {

        set({
            updateState: { ...get().updateState, status: "checking", error: null },
        });

        try {
            const result = await checkForAppUpdate();
            if (!result) {
                set({
                    updateState: {
                        ...get().updateState,
                        status: "up-to-date",
                    },
                });
                return;
            }

            const { update, summary } = result;
            set({
                updateState: {
                    ...get().updateState,
                    status: "available",
                    currentVersion: summary.currentVersion,
                    latestVersion: summary.version,
                    availableUpdate: summary,
                },
                pendingUpdate: update,
            });
        } catch (err) {
            set({
                updateState: {
                    ...get().updateState,
                    status: "error",
                    error: classifyUpdateError(err),
                },
            });
        }
    },

    downloadUpdate: async () => {
        const { pendingUpdate } = get();
        if (!pendingUpdate) {
            useToastStore.getState().addToast("error", i18n.t("settings:about.updateNoUpdate"));
            return;
        }

        set({
            updateState: {
                ...get().updateState,
                status: "downloading",
                downloadedBytes: 0,
                contentLength: null,
            },
        });

        try {
            const onEvent = (event: DownloadEvent) => {
                const current = get().updateState;
                switch (event.event) {
                    case "Started":
                        set({
                            updateState: {
                                ...current,
                                contentLength: event.data.contentLength ?? null,
                            },
                        });
                        break;
                    case "Progress":
                        set({
                            updateState: {
                                ...get().updateState,
                                downloadedBytes: get().updateState.downloadedBytes + event.data.chunkLength,
                            },
                        });
                        break;
                    case "Finished":
                        break;
                }
            };

            const summary = await downloadAppUpdate(pendingUpdate, onEvent);
            set({
                updateState: {
                    ...get().updateState,
                    status: "downloaded",
                    downloadedVersion: summary.version,
                },
            });
            useToastStore.getState().addToast("success", i18n.t("settings:about.updateDownloaded"));
        } catch (err) {
            set({
                updateState: {
                    ...get().updateState,
                    status: "error",
                    error: classifyUpdateError(err),
                },
            });
            useToastStore.getState().addToast("error", i18n.t("settings:about.updateDownloadFailed"));
        }
    },

    installUpdate: async () => {
        const { pendingUpdate } = get();
        if (!pendingUpdate) return;

        try {
            await installAppUpdate(pendingUpdate);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            useToastStore.getState().addToast("error", `${i18n.t("settings:about.updateInstallFailed")}: ${message}`);
        }
    },

    startAutoUpdateCheck: () => {
        if (hasRunStartupCheck) return;

        const settings = useSettingsStore.getState().settings;
        if (!settings.autoUpdateEnabled) return;

        hasRunStartupCheck = true;

        get().checkForUpdates()
            .then(() => {
                const state = get().updateState;
                if (state.status === "available" && get().pendingUpdate) {
                    return get().downloadUpdate();
                }
            })
            .catch(() => {});
    },
}));

// 立即获取当前版本号，不依赖更新检查
fetchAppVersion().then((ver) => {
    useUpdaterStore.setState((s) => ({
        updateState: { ...s.updateState, currentVersion: ver },
    }));
}).catch(() => {});
