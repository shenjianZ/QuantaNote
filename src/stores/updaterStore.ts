import { create } from "zustand";
import { checkForAppUpdate, downloadAppUpdate, installAppUpdate } from "../lib/updater";
import type { UpdateState } from "../lib/update-types";
import type { Update, DownloadEvent } from "@tauri-apps/plugin-updater";
import { useSettingsStore } from "./settingsStore";
import { useToastStore } from "./toastStore";
import i18n from "../i18n";

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
    currentVersion: "0.1.0",
    latestVersion: null,
    downloadedVersion: null,
    contentLength: null,
    downloadedBytes: 0,
    error: null,
    availableUpdate: null,
};

let hasRunStartupCheck = false;

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
                    latestVersion: summary.version,
                    availableUpdate: summary,
                },
                pendingUpdate: update,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            set({
                updateState: {
                    ...get().updateState,
                    status: "error",
                    error: message,
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
            const message = err instanceof Error ? err.message : String(err);
            set({
                updateState: {
                    ...get().updateState,
                    status: "error",
                    error: message,
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
