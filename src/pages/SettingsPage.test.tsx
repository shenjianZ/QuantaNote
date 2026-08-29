import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
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
                contentWidthProgress: 0,
                showDocumentOutline: true,
                minimizeToTray: false,
                closeKeepRunning: false,
                autoBackup: false,
                autostart: false,
                autoUpdateEnabled: false,
                floatingBall: false,
                floatingBallPosition: null,
                customAccentColors: [],
                sqlLogging: {
                    enabled: false,
                    toConsole: false,
                    toFile: true,
                    pretty: false,
                    maxLen: 4000,
                },
                locale: "zh-CN",
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
            fetchStorageConsistency: vi.fn(),
            repairStorageConsistency: vi.fn(),
            updateSqlLogging: updateSqlLoggingMock,
            clearSqlLogFile: vi.fn(),
        });
    });

    it("renders appearance section by default", () => {
        setup(<SettingsPage />);
        expect(screen.getByText("外观主题")).toBeInTheDocument();
        expect(screen.getByTestId("settings-content-width-control")).toBeInTheDocument();
    });

    it("updates the shared content width setting from a preset", async () => {
        const { user } = setup(<SettingsPage />);
        await user.click(screen.getByTestId("settings-content-width-control-preset-comfortable"));
        expect(updateSettingMock).toHaveBeenCalledWith("contentWidthProgress", 25);
    });

    it("toggles the document outline visibility setting", async () => {
        const { user } = setup(<SettingsPage />);
        const toggle = screen.getByTestId("settings-document-outline-toggle");

        expect(toggle).toHaveAttribute("aria-checked", "true");
        await user.click(toggle);

        expect(updateSettingMock).toHaveBeenCalledWith("showDocumentOutline", false);
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

    it("updates floating ball coordinates", async () => {
        setup(<SettingsPage />);
        fireEvent.change(screen.getByTestId("floating-ball-x-input"), {
            target: { value: "120" },
        });
        expect(updateSettingMock).toHaveBeenCalledWith(
            "floatingBallPosition",
            { x: 120, y: 0 },
        );
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

    it("shows storage consistency counts and file details", async () => {
        useSettingsStore.setState({
            storageReport: {
                missingFiles: [{
                    path: "attachments/item/missing.png",
                    attachmentId: "att-missing",
                    itemId: "item",
                    filename: "missing.png",
                    sizeBytes: 12,
                    reason: "数据库记录存在，但附件文件不存在",
                }],
                orphanFiles: [],
                brokenReferences: [],
                scannedFiles: 1,
                storageBytes: 12,
            },
        });
        const { user } = setup(<SettingsPage />);

        await user.click(screen.getByText("数据"));
        expect(screen.getByTestId("storage-missing-count")).toHaveTextContent("1");
        expect(screen.getByTestId("storage-missing-details")).toHaveTextContent("missing.png");
    });
});
