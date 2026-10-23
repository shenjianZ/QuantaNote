import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cloud, Database, Keyboard, Palette, Settings2, SlidersHorizontal, Sparkles } from "lucide-react";
import type { ThemeMode } from "../hooks/useTheme";
import { useSettingsStore } from "../stores/settingsStore";
import { useAppStore } from "../stores/appStore";
import { AppearanceSection } from "./settings/sections/AppearanceSection";
import { EditorSection } from "./settings/sections/EditorSection";
import { ShortcutsSection } from "./settings/sections/ShortcutsSection";
import { AiSection } from "./settings/sections/AiSection";
import { DataSection } from "./settings/sections/DataSection";
import { SyncSection } from "./settings/sections/SyncSection";
import { AboutSection } from "./settings/sections/AboutSection";

interface SettingsPageProps {
    theme?: ThemeMode;
    onThemeChange?: (theme: ThemeMode) => void;
}

export function SettingsPage({ theme = "system", onThemeChange }: SettingsPageProps) {
    const { t } = useTranslation(["settings", "common"]);
    const settingsSection = useAppStore((s) => s.settingsSection);
    const setSettingsSection = useAppStore((s) => s.setSettingsSection);
    const [activeSection, setActiveSection] = useState(settingsSection ?? 0);

    // 全局数据初始化（各分区按需自取 store 数据）
    useEffect(() => {
        const store = useSettingsStore.getState();
        store.init();
        store.refreshDbSize();
        store.fetchDbPath();
        store.fetchAutoBackupConfig();
        store.fetchBackupDirPath();
        store.fetchBackups();
        store.fetchDiagnosticsPaths();
        store.fetchStorageConsistency();
    }, []);

    useEffect(() => {
        if (settingsSection != null) {
            setActiveSection(settingsSection);
            setSettingsSection(null);
        }
    }, [settingsSection, setSettingsSection]);

    const settingsMenu = [
        { label: t("settings:menu.appearance"), icon: Palette },
        { label: t("settings:menu.editor"), icon: SlidersHorizontal },
        { label: t("settings:menu.shortcuts"), icon: Keyboard },
        { label: t("settings:menu.ai"), icon: Sparkles },
        { label: t("settings:menu.data"), icon: Database },
        { label: t("settings:menu.sync"), icon: Cloud },
        { label: t("settings:menu.about"), icon: Settings2 },
    ];

    return (
        <div className="flex h-full min-h-0 flex-col gap-2 bg-[var(--app-bg)] p-2 sm:flex-row sm:gap-3 sm:p-4">
            <nav className="flex shrink-0 gap-1 overflow-x-auto px-1 sm:w-36 sm:flex-col sm:space-y-1 sm:overflow-x-visible sm:px-0">
                {settingsMenu.map((item, index) => {
                    const Icon = item.icon;
                    return (
                        <button
                            className={`flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm ${index === activeSection ? "bg-[var(--nav-active)] text-[var(--text)] font-medium" : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"}`}
                            key={item.label}
                            data-testid={`settings-nav-${index}`}
                            onClick={() => setActiveSection(index)}
                            type="button"
                        >
                            <Icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <main className="min-h-0 flex-1 overflow-auto rounded-3xl border border-[var(--line)] bg-[var(--paper)] p-3 sm:p-5">
                {activeSection === 0 && <AppearanceSection theme={theme} onThemeChange={onThemeChange} />}
                {activeSection === 1 && <EditorSection />}
                {activeSection === 2 && <ShortcutsSection />}
                {activeSection === 3 && <AiSection />}
                {activeSection === 4 && <DataSection />}
                {activeSection === 5 && <SyncSection />}
                {activeSection === 6 && <AboutSection />}
            </main>
        </div>
    );
}
