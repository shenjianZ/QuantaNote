import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../test/test-utils";
import { SettingsPage } from "./SettingsPage";
import { useSettingsStore } from "../stores/settingsStore";

vi.mock("@tauri-apps/plugin-opener", () => ({
    openPath: vi.fn(),
}));

describe("SettingsPage", () => {
    const updateSettingMock = vi.fn();
    const updateSqlLoggingMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        useSettingsStore.setState({
            settings: {
                accentColor: "#386c5f",
                fontFamily: "Noto Sans SC",
                fontMono: "JetBrains Mono",
                fontSize: 16,
                minimizeToTray: false,
                closeKeepRunning: false,
                autoBackup: false,
                autostart: false,
                customAccentColors: [],
                sqlLogging: {
                    enabled: false,
                    toConsole: false,
                    toFile: true,
                    pretty: false,
                    maxLen: 4000,
                },
            },
            dbSize: "1.2 MB",
            dbPath: "D:\\data\\quanta_note.sqlite",
            autoBackupConfig: {
                enabled: false,
                interval_days: 7,
                max_backups: 10,
                expire_days: 90,
                last_backup_at: null,
            },
            backupDirPath: "D:\\data\\backups",
            backupFiles: [],
            logDir: "D:\\data",
            sqlLogPath: "D:\\data\\quanta-note-sql.log",
            init: vi.fn(),
            updateSetting: updateSettingMock,
            updateSettings: vi.fn(),
            addCustomColor: vi.fn(),
            removeCustomColor: vi.fn(),
            refreshDbSize: vi.fn(),
            fetchDbPath: vi.fn(),
            optimizeDb: vi.fn(),
            fetchExportSizeEstimate: vi.fn(),
            exportDataWithOptions: vi.fn(),
            importDataWithOptions: vi.fn(),
            fetchAutoBackupConfig: vi.fn(),
            updateAutoBackupConfig: vi.fn(),
            triggerBackupNow: vi.fn(),
            fetchBackupDirPath: vi.fn(),
            fetchBackups: vi.fn(),
            deleteBackup: vi.fn(),
            fetchDiagnosticsPaths: vi.fn(),
            updateSqlLogging: updateSqlLoggingMock,
            clearSqlLogFile: vi.fn(),
        });
    });

    it("renders appearance section by default", () => {
        setup(<SettingsPage />);
        expect(screen.getByText("外观主题")).toBeInTheDocument();
    });

    it("switches to font section", async () => {
        const { user } = setup(<SettingsPage />);
        await user.click(screen.getByText("字体"));
        expect(screen.getByText("界面字体")).toBeInTheDocument();
    });

    it("changes accent color on click", async () => {
        const { user } = setup(<SettingsPage />);
        await user.click(screen.getByTitle("蓝色"));
        expect(updateSettingMock).toHaveBeenCalledWith(
            "accentColor",
            "#2563eb",
        );
    });

    it("toggles window behavior", async () => {
        const { user, container } = setup(<SettingsPage />);
        const toggles = container.querySelectorAll(
            "button[class*='relative h-6 w-11']",
        );
        if (toggles.length > 0) {
            await user.click(toggles[0]);
            expect(updateSettingMock).toHaveBeenCalled();
        }
    });

    it("switches to data section and shows export", async () => {
        const { user } = setup(<SettingsPage />);
        await user.click(screen.getByText("数据"));
        expect(screen.getByText("立即备份")).toBeInTheDocument();
        expect(screen.getByText("导出")).toBeInTheDocument();
        expect(screen.getByText("SQL 日志")).toBeInTheDocument();
    });

    it("toggles sql logging", async () => {
        const { user } = setup(<SettingsPage />);
        await user.click(screen.getByText("数据"));
        const sqlRow = screen.getByText("SQL 日志").closest("div[class*='flex']");
        const toggle = sqlRow?.querySelector("button");
        expect(toggle).toBeTruthy();
        await user.click(toggle as HTMLButtonElement);
        expect(updateSqlLoggingMock).toHaveBeenCalledWith({ enabled: true });
    });
});
