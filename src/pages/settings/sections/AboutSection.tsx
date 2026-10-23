import { useTranslation } from "react-i18next";
import { BookOpen, Github, MessageSquare, RefreshCw } from "lucide-react";
import { useSettingsStore } from "../../../stores/settingsStore";
import { useUpdaterStore } from "../../../stores/updaterStore";
import { isMobile } from "../../../utils/platform";
import { SettingsGroup, SettingsHeader, SettingsRow, SettingsToggle, PrimaryButton } from "../ui";

export function AboutSection() {
    const { t } = useTranslation(["settings", "common"]);
    const settings = useSettingsStore((s) => s.settings);
    const updateSetting = useSettingsStore((s) => s.updateSetting);
    const updateState = useUpdaterStore((s) => s.updateState);
    const checkForUpdates = useUpdaterStore((s) => s.checkForUpdates);
    const downloadUpdate = useUpdaterStore((s) => s.downloadUpdate);
    const installUpdate = useUpdaterStore((s) => s.installUpdate);
    const isMobilePlatform = isMobile();

    const statusText = (() => {
        switch (updateState.status as string) {
            case "idle": return t("settings:about.updateStatusIdle");
            case "checking": return t("settings:about.updateStatusChecking");
            case "available": return t("settings:about.updateStatusAvailable");
            case "downloading": return t("settings:about.updateStatusDownloading");
            case "downloaded": return t("settings:about.updateStatusDownloaded");
            case "up-to-date": return t("settings:about.updateStatusUpToDate");
            case "error": return updateState.error || t("settings:about.updateStatusError");
            default: return "";
        }
    })();

    return (
        <>
            <SettingsHeader
                icon={<span className="rounded-md bg-[var(--accent)] px-1.5 py-0.5 text-xs font-bold text-white">Q</span>}
                title="QuantaNote"
                description={t("settings:about.description")}
            />

            <SettingsGroup>
                <SettingsRow
                    label={t("settings:about.currentVersion")}
                    testId="settings-about-version-row"
                >
                    <span data-testid="settings-about-version" className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)]">
                        v{updateState.currentVersion}
                    </span>
                </SettingsRow>
                <SettingsRow label={t("settings:about.author")}>
                    <span className="text-sm text-[var(--muted)]">{t("settings:about.authorName", { defaultValue: "shenjianZ" })}</span>
                </SettingsRow>
                <SettingsRow label={t("settings:about.techStackLabel", { defaultValue: t("settings:about.techStack") })}>
                    <span className="text-sm text-[var(--muted)]">{t("settings:about.techStack")}</span>
                </SettingsRow>
                <SettingsRow label={t("settings:about.links")}>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="translate-y-[1px]"><Github size={13} /></span>
                        {t("settings:about.github")}
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://quantanote-docs.shenjianl.cn/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="translate-y-[1px]"><BookOpen size={13} /></span>
                        {t("settings:about.docs")}
                    </a>
                    <a
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--hover)]"
                        href="https://github.com/shenjianZ/QuantaNote/issues"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span className="translate-y-[1px]"><MessageSquare size={13} /></span>
                        {t("settings:about.feedback")}
                    </a>
                </SettingsRow>
            </SettingsGroup>

            {!isMobilePlatform && (
                <SettingsGroup title={t("settings:about.updateSection")}>
                    <SettingsRow label={t("settings:about.autoUpdateEnabled")} desc={t("settings:about.autoUpdateEnabledDesc")}>
                        <SettingsToggle value={settings.autoUpdateEnabled} onChange={(v) => updateSetting("autoUpdateEnabled", v)} />
                    </SettingsRow>
                    <SettingsRow label={t("settings:about.updateStatus")}>
                        <span className="text-sm text-[var(--muted)]">
                            {statusText}
                            {updateState.latestVersion && <span className="ml-2">v{updateState.latestVersion}</span>}
                        </span>
                    </SettingsRow>
                    {updateState.status === "downloading" && updateState.contentLength !== null && (
                        <div className="mx-4 my-2 space-y-1.5">
                            <div className="h-2 rounded-full bg-[var(--field)]">
                                <div
                                    className="h-2 rounded-full bg-[var(--accent)] transition-[width]"
                                    style={{ width: `${Math.min(100, Math.round((updateState.downloadedBytes / updateState.contentLength) * 100))}%` }}
                                />
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                                {Math.round((updateState.downloadedBytes / updateState.contentLength) * 100)}%
                            </div>
                        </div>
                    )}
                    <SettingsRow label={t("settings:about.updateCheck")}>
                        <PrimaryButton
                            disabled={updateState.status === "checking" || updateState.status === "downloading"}
                            onClick={() => checkForUpdates()}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${updateState.status === "checking" ? "animate-spin" : ""}`} />
                            {t("settings:about.updateCheck")}
                        </PrimaryButton>
                        {updateState.status === "downloaded" && (
                            <PrimaryButton onClick={() => installUpdate()}>
                                {t("settings:about.updateInstall")}
                            </PrimaryButton>
                        )}
                        {updateState.status === "available" && (
                            <PrimaryButton onClick={() => downloadUpdate()}>
                                {t("settings:about.updateDownload")}
                            </PrimaryButton>
                        )}
                    </SettingsRow>
                </SettingsGroup>
            )}
        </>
    );
}
