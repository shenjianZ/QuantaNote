import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Laptop, Moon, Palette, Sun, X } from "lucide-react";
import type { ThemeMode } from "../../../hooks/useTheme";
import { ColorPickerModal } from "../../../components/common/ColorPickerModal";
import { Select } from "../../../components/common/Select";
import { useSettingsStore, type CustomColor } from "../../../stores/settingsStore";
import { isMobile } from "../../../utils/platform";
import { SettingsGroup, SettingsHeader, SettingsRow, SettingsToggle, SecondaryButton } from "../ui";

const ACCENT_COLOR_KEYS = [
    { value: "#386c5f", labelKey: "settings:appearance.colors.green" },
    { value: "#2563eb", labelKey: "settings:appearance.colors.blue" },
    { value: "#7c3aed", labelKey: "settings:appearance.colors.purple" },
    { value: "#c47b12", labelKey: "settings:appearance.colors.amber" },
    { value: "#b64242", labelKey: "settings:appearance.colors.red" },
    { value: "#0891b2", labelKey: "settings:appearance.colors.cyan" },
    { value: "#059669", labelKey: "settings:appearance.colors.emerald" },
    { value: "#d97706", labelKey: "settings:appearance.colors.orange" },
    { value: "#e11d48", labelKey: "settings:appearance.colors.rose" },
    { value: "#6366f1", labelKey: "settings:appearance.colors.indigo" },
    { value: "#8b5cf6", labelKey: "settings:appearance.colors.violet" },
    { value: "#64748b", labelKey: "settings:appearance.colors.slate" },
];

interface AppearanceSectionProps {
    theme: ThemeMode;
    onThemeChange?: (theme: ThemeMode) => void;
}

export function AppearanceSection({ theme, onThemeChange }: AppearanceSectionProps) {
    const { t } = useTranslation(["settings", "common"]);
    const settings = useSettingsStore((s) => s.settings);
    const updateSetting = useSettingsStore((s) => s.updateSetting);
    const addCustomColor = useSettingsStore((s) => s.addCustomColor);
    const removeCustomColor = useSettingsStore((s) => s.removeCustomColor);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const isMobilePlatform = isMobile();

    function updateFloatingBallPosition(axis: "x" | "y", value: string) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;
        const current = settings.floatingBallPosition ?? { x: 0, y: 0 };
        updateSetting("floatingBallPosition", { ...current, [axis]: Math.round(numericValue) });
    }

    const themeOptions = [
        { value: "system" as ThemeMode, icon: Laptop, label: t("settings:appearance.system") },
        { value: "light" as ThemeMode, icon: Sun, label: t("settings:appearance.light") },
        { value: "dark" as ThemeMode, icon: Moon, label: t("settings:appearance.dark") },
    ];

    return (
        <>
            <SettingsHeader icon={<Palette className="h-4.5 w-4.5" />} title={t("settings:menu.appearance")} description={t("settings:appearance.description")} />

            <SettingsGroup title={t("settings:appearance.theme")}>
                <SettingsRow label={t("settings:appearance.themeMode")}>
                    <div className="flex flex-wrap justify-end gap-2">
                        {themeOptions.map((opt) => {
                            const Icon = opt.icon;
                            return (
                                <button
                                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs ${theme === opt.value ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--line)] bg-[var(--field)] text-[var(--muted)] hover:text-[var(--text)]"}`}
                                    key={opt.value}
                                    data-testid={`theme-${opt.value}`}
                                    role="radio"
                                    aria-checked={theme === opt.value}
                                    aria-label={opt.label}
                                    onClick={() => onThemeChange?.(opt.value)}
                                    type="button"
                                >
                                    <Icon className="h-3.5 w-3.5" />
                                    {opt.label}
                                </button>
                            );
                        })}
                    </div>
                </SettingsRow>
                <SettingsRow label={t("settings:data.locale")} desc={t("settings:data.localeDesc")}>
                    <Select
                        className="w-36"
                        options={[
                            { value: "zh-CN", label: t("settings:localeOptions.zh-CN") },
                            { value: "en", label: t("settings:localeOptions.en") },
                        ]}
                        value={settings.locale}
                        onChange={(v) => updateSetting("locale", v as "zh-CN" | "en")}
                    />
                </SettingsRow>
            </SettingsGroup>

            <SettingsGroup title={t("settings:appearance.accentColor")}>
                <SettingsRow label={t("settings:appearance.predefined")} stacked>
                    <div className="flex flex-wrap gap-2.5">
                        {ACCENT_COLOR_KEYS.map((c) => (
                            <button
                                className={`settings-color-swatch rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.value === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                                key={c.value}
                                data-testid="accent-color"
                                style={{ background: c.value }}
                                title={t(c.labelKey)}
                                type="button"
                                onClick={() => updateSetting("accentColor", c.value)}
                            />
                        ))}
                    </div>
                </SettingsRow>
                <SettingsRow label={t("settings:appearance.custom")} stacked>
                    <div className="flex flex-wrap items-center gap-2.5">
                        {settings.customAccentColors.map((c: CustomColor) => (
                            <div className="group relative" key={c.hex}>
                                <button
                                    className={`settings-color-swatch rounded-full border border-[var(--line)] transition-transform hover:scale-110 ${c.hex === settings.accentColor ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
                                    style={{ background: c.hex }}
                                    title={`${c.name} (${c.hex.toUpperCase()})`}
                                    type="button"
                                    onClick={() => updateSetting("accentColor", c.hex)}
                                />
                                <button
                                    type="button"
                                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--danger)] text-white opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeCustomColor(c.hex);
                                    }}
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            data-testid="settings-add-custom-color-btn"
                            className="settings-color-swatch flex items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                            title={t("settings:appearance.addCustomColor")}
                            onClick={() => setColorPickerOpen(true)}
                        >
                            <span className="text-sm leading-none">+</span>
                        </button>
                    </div>
                    <ColorPickerModal
                        open={colorPickerOpen}
                        onConfirm={(hex, name) => {
                            addCustomColor(hex, name);
                            updateSetting("accentColor", hex);
                            setColorPickerOpen(false);
                        }}
                        onCancel={() => setColorPickerOpen(false)}
                    />
                </SettingsRow>
            </SettingsGroup>

            {!isMobilePlatform && (
                <SettingsGroup title={t("settings:appearance.windowBehavior")}>
                    {([
                        { key: "minimizeToTray" as const, label: t("settings:appearance.minimizeToTray"), desc: t("settings:appearance.minimizeToTrayDesc") },
                        { key: "closeKeepRunning" as const, label: t("settings:appearance.closeKeepRunning"), desc: t("settings:appearance.closeKeepRunningDesc") },
                        { key: "floatingBall" as const, label: t("settings:appearance.floatingBall"), desc: t("settings:appearance.floatingBallDesc") },
                    ]).map((item) => (
                        <SettingsRow key={item.key} label={item.label} desc={item.desc}>
                            <SettingsToggle value={settings[item.key]} onChange={(v) => updateSetting(item.key, v)} />
                        </SettingsRow>
                    ))}
                    <SettingsRow label={t("settings:appearance.floatingBallPosition")} desc={t("settings:appearance.floatingBallPositionDesc")}>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                                <span>X</span>
                                <input
                                    data-testid="floating-ball-x-input"
                                    className="h-8 w-20 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                    inputMode="numeric"
                                    type="number"
                                    value={settings.floatingBallPosition?.x ?? ""}
                                    placeholder={t("settings:appearance.floatingBallDefault")}
                                    onChange={(e) => updateFloatingBallPosition("x", e.currentTarget.value)}
                                />
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                                <span>Y</span>
                                <input
                                    data-testid="floating-ball-y-input"
                                    className="h-8 w-20 rounded-full border border-[var(--line)] bg-[var(--field)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                                    inputMode="numeric"
                                    type="number"
                                    value={settings.floatingBallPosition?.y ?? ""}
                                    placeholder={t("settings:appearance.floatingBallDefault")}
                                    onChange={(e) => updateFloatingBallPosition("y", e.currentTarget.value)}
                                />
                            </label>
                            <SecondaryButton onClick={() => updateSetting("floatingBallPosition", null)}>
                                {t("settings:appearance.floatingBallReset")}
                            </SecondaryButton>
                        </div>
                    </SettingsRow>
                </SettingsGroup>
            )}

            {!isMobilePlatform && (
                <SettingsGroup title={t("settings:appearance.systemSection")}>
                    <SettingsRow label={t("settings:appearance.autostart")}>
                        <SettingsToggle value={settings.autostart} onChange={(v) => updateSetting("autostart", v)} />
                    </SettingsRow>
                </SettingsGroup>
            )}
        </>
    );
}
