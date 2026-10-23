import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyRound, Sparkles, Bot } from "lucide-react";
import { useSettingsStore } from "../../../stores/settingsStore";
import { DEFAULT_AI_CONFIG, useAiStore } from "../../../stores/aiStore";
import type { AiConfig } from "../../../services/tauriCommands";
import { ModelManagerModal } from "../dialogs/ModelManagerModal";
import { ApiKeyModal } from "../dialogs/ApiKeyModal";
import { SettingsBadge, SettingsGroup, SettingsHeader, SettingsRow, SettingsToggle, SecondaryButton, inputClass } from "../ui";

export function AiSection() {
    const { t } = useTranslation(["settings", "common"]);
    const settings = useSettingsStore((s) => s.settings);
    const updateSetting = useSettingsStore((s) => s.updateSetting);
    const aiConfig = useAiStore((s) => s.config);
    const fetchAiConfig = useAiStore((s) => s.fetchConfig);
    const updateAiConfig = useAiStore((s) => s.updateConfig);
    const saveAiApiKey = useAiStore((s) => s.saveApiKey);
    const clearAiApiKey = useAiStore((s) => s.clearApiKey);

    const [aiDraft, setAiDraft] = useState<AiConfig>(DEFAULT_AI_CONFIG);
    const [modelManagerOpen, setModelManagerOpen] = useState(false);
    const [apiKeyOpen, setApiKeyOpen] = useState(false);
    const [chatModelOpen, setChatModelOpen] = useState(false);

    useEffect(() => {
        fetchAiConfig();
    }, [fetchAiConfig]);

    useEffect(() => {
        if (aiConfig) setAiDraft(aiConfig);
    }, [aiConfig]);

    function updateAiDraft<K extends keyof AiConfig>(field: K, value: AiConfig[K]) {
        setAiDraft((current) => ({ ...current, [field]: value }));
    }

    function saveAiConfig(updates?: Partial<AiConfig>) {
        void updateAiConfig({ ...aiDraft, ...updates });
    }

    return (
        <>
            <SettingsHeader
                icon={<Sparkles className="h-4.5 w-4.5" />}
                title={t("settings:menu.ai")}
                description={t("settings:ai.description")}
            />

            <SettingsGroup testId="ai-summary-settings">
                <SettingsRow label={t("settings:data.enableAiSummary")} desc={t("settings:data.aiSummaryDesc")}>
                    <SettingsToggle
                        value={aiDraft.enabled}
                        onChange={(value) => {
                            updateAiDraft("enabled", value);
                            saveAiConfig({ enabled: value });
                        }}
                        testId="ai-summary-toggle"
                    />
                </SettingsRow>

                {aiDraft.enabled && (
                    <>
                        <SettingsRow label={t("settings:data.aiEndpoint")} stacked>
                            <div className="flex items-center gap-2">
                                <input
                                    className={inputClass}
                                    data-testid="ai-summary-endpoint"
                                    type="url"
                                    value={aiDraft.endpoint}
                                    onChange={(event) => updateAiDraft("endpoint", event.target.value)}
                                    placeholder="https://api.openai.com/v1/chat/completions"
                                    onBlur={() => saveAiConfig()}
                                />
                            </div>
                        </SettingsRow>

                        <SettingsRow label={t("settings:data.aiModel")} desc={t("settings:ai.modelDesc")}>
                            <button
                                className="inline-flex max-w-56 items-center gap-1.5 truncate rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                                type="button"
                                data-testid="ai-summary-model"
                                title={aiDraft.model}
                                onClick={() => setModelManagerOpen(true)}
                            >
                                <span className="truncate">{aiDraft.model || t("settings:ai.modelEmpty")}</span>
                            </button>
                        </SettingsRow>

                        <SettingsRow label={t("settings:data.aiApiKey")}>
                            <div className="flex items-center gap-2">
                                <SettingsBadge tone={aiDraft.api_key_configured ? "ok" : "neutral"}>
                                    <KeyRound className="h-3 w-3" />
                                    {aiDraft.api_key_configured ? t("settings:ai.apiKeyConfigured") : t("settings:ai.apiKeyNotConfigured")}
                                </SettingsBadge>
                                <SecondaryButton data-testid="ai-api-key-manage-btn" onClick={() => setApiKeyOpen(true)}>
                                    {t("settings:ai.apiKeyManage")}
                                </SecondaryButton>
                            </div>
                        </SettingsRow>

                        <SettingsRow label={t("settings:ai.chatModel")} desc={t("settings:ai.chatModelDesc")}>
                            {settings.aiChatModel && (
                                <SecondaryButton onClick={() => updateSetting("aiChatModel", "")}>
                                    {t("settings:ai.chatModelDefault")}
                                </SecondaryButton>
                            )}
                            <button
                                className="inline-flex max-w-56 items-center gap-1.5 truncate rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs text-[var(--text)] transition-colors hover:border-[var(--accent)]"
                                type="button"
                                title={settings.aiChatModel || t("settings:ai.chatModelDefault")}
                                onClick={() => setChatModelOpen(true)}
                            >
                                <Bot className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                                <span className="truncate">{settings.aiChatModel || t("settings:ai.chatModelDefault")}</span>
                            </button>
                        </SettingsRow>
                    </>
                )}
            </SettingsGroup>

            <ModelManagerModal
                open={modelManagerOpen}
                onClose={() => setModelManagerOpen(false)}
                endpoint={aiDraft.endpoint}
                currentModel={aiDraft.model}
                onSelect={(model) => {
                    updateAiDraft("model", model);
                    saveAiConfig({ model });
                }}
            />

            <ApiKeyModal
                open={apiKeyOpen}
                onClose={() => setApiKeyOpen(false)}
                configured={aiDraft.api_key_configured}
                onSave={saveAiApiKey}
                onClear={clearAiApiKey}
            />

            {/* 聊天默认模型选择（复用模型管理对话框） */}
            <ModelManagerModal
                open={chatModelOpen}
                onClose={() => setChatModelOpen(false)}
                endpoint={aiDraft.endpoint}
                currentModel={settings.aiChatModel}
                onSelect={(model) => {
                    updateSetting("aiChatModel", model);
                    setChatModelOpen(false);
                }}
            />
        </>
    );
}
