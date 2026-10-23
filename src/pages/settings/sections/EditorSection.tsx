import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import { ContentWidthControl } from "../../../components/common/ContentWidthControl";
import { Select } from "../../../components/common/Select";
import { useSettingsStore, clampDockPanelWidth, DOCK_PANEL_WIDTH_MIN, DOCK_PANEL_WIDTH_MAX } from "../../../stores/settingsStore";
import { SettingsGroup, SettingsHeader, SettingsRow, SettingsToggle } from "../ui";

const FONT_OPTIONS_KEYS = [
    { value: "Noto Sans SC", label: "Noto Sans SC" },
    { value: "system-ui", labelKey: "settings:font.systemDefault" },
];

const MONO_OPTIONS_KEYS = [
    { value: "JetBrains Mono", label: "JetBrains Mono" },
    { value: "Consolas", label: "Consolas" },
    { value: "monospace", labelKey: "settings:font.systemMono" },
];

export function EditorSection() {
    const { t } = useTranslation(["settings"]);
    const settings = useSettingsStore((s) => s.settings);
    const updateSetting = useSettingsStore((s) => s.updateSetting);

    return (
        <>
            <SettingsHeader icon={<SlidersHorizontal className="h-4.5 w-4.5" />} title={t("settings:menu.editor")} description={t("settings:editor.description")} />

            <SettingsGroup title={t("settings:contentWidth.title")}>
                <SettingsRow label={t("settings:contentWidth.description")} stacked>
                    <ContentWidthControl testId="settings-content-width-control" />
                </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title={t("settings:documentOutline.title")}>
                <SettingsRow label={t("settings:documentOutline.enabled")} desc={t("settings:documentOutline.description")}>
                    <SettingsToggle
                        value={settings.showDocumentOutline}
                        onChange={(value) => updateSetting("showDocumentOutline", value)}
                        testId="settings-document-outline-toggle"
                        ariaLabel={t("settings:documentOutline.enabled")}
                    />
                </SettingsRow>
                <SettingsRow label={t("settings:documentOutline.panelWidth")} stacked>
                    <div className="flex items-center justify-between gap-3">
                        <input
                            className="w-full accent-[var(--accent)]"
                            type="range"
                            min={DOCK_PANEL_WIDTH_MIN}
                            max={DOCK_PANEL_WIDTH_MAX}
                            step={8}
                            value={settings.dockPanelWidth}
                            data-testid="settings-dock-panel-width-slider"
                            aria-label={t("settings:documentOutline.panelWidth")}
                            onChange={(event) => updateSetting("dockPanelWidth", clampDockPanelWidth(event.currentTarget.value))}
                        />
                        <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">{settings.dockPanelWidth} px</span>
                    </div>
                </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title={t("settings:font.title")}>
                <SettingsRow label={t("settings:font.uiFont")}>
                    <Select
                        className="w-48"
                        options={FONT_OPTIONS_KEYS.map((o) => ({ value: o.value, label: o.label ?? t(o.labelKey!) }))}
                        value={settings.fontFamily}
                        onChange={(v) => updateSetting("fontFamily", v)}
                    />
                </SettingsRow>
                <SettingsRow label={t("settings:font.monoFont")}>
                    <Select
                        className="w-48"
                        options={MONO_OPTIONS_KEYS.map((o) => ({ value: o.value, label: o.label ?? t(o.labelKey!) }))}
                        value={settings.fontMono}
                        onChange={(v) => updateSetting("fontMono", v)}
                    />
                </SettingsRow>
                <SettingsRow label={t("settings:font.uiFontSize")}>
                    <Select
                        className="w-24"
                        options={["14", "15", "16", "17", "18"].map((n) => ({ value: n, label: `${n} px` }))}
                        value={String(settings.fontSize)}
                        onChange={(v) => updateSetting("fontSize", Number(v))}
                    />
                </SettingsRow>
                <SettingsRow label={t("settings:font.preview")} stacked>
                    <div className="rounded-xl bg-[var(--field)] p-3 text-sm text-[var(--text)]">{t("settings:font.preview")}</div>
                </SettingsRow>
            </SettingsGroup>
        </>
    );
}
