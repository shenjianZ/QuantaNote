import { create } from "zustand";
import {
    clearAiApiKey,
    getAiConfig,
    saveAiApiKey,
    updateAiConfig,
    type AiConfig,
} from "../services/tauriCommands";
import i18n from "../i18n";
import { useToastStore } from "./toastStore";

export const DEFAULT_AI_CONFIG: AiConfig = {
    enabled: false,
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    api_key_configured: false,
};

interface AiState {
    config: AiConfig | null;
    fetchConfig: () => Promise<void>;
    updateConfig: (config: AiConfig) => Promise<boolean>;
    saveApiKey: (apiKey: string) => Promise<boolean>;
    clearApiKey: () => Promise<boolean>;
}

export const useAiStore = create<AiState>((set, get) => ({
    config: null,

    fetchConfig: async () => {
        try {
            set({ config: await getAiConfig() });
        } catch {
            set({ config: null });
        }
    },

    updateConfig: async (config) => {
        try {
            await updateAiConfig(config);
            await get().fetchConfig();
            useToastStore.getState().addToast("success", i18n.t("common:toast.aiConfigUpdated"));
            return true;
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.aiConfigUpdateFailed"));
            return false;
        }
    },

    saveApiKey: async (apiKey) => {
        try {
            await saveAiApiKey(apiKey);
            await get().fetchConfig();
            useToastStore.getState().addToast("success", i18n.t("common:toast.aiApiKeySaved"));
            return true;
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.aiApiKeySaveFailed"));
            return false;
        }
    },

    clearApiKey: async () => {
        try {
            await clearAiApiKey();
            await get().fetchConfig();
            useToastStore.getState().addToast("success", i18n.t("common:toast.aiApiKeyCleared"));
            return true;
        } catch {
            useToastStore.getState().addToast("error", i18n.t("common:toast.aiApiKeyClearFailed"));
            return false;
        }
    },
}));
