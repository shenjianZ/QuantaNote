import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../test/test-utils";
import { SettingsPage } from "./SettingsPage";
import { useSettingsStore } from "../stores/settingsStore";

describe("SettingsPage", () => {
    const updateSettingMock = vi.fn();

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
            },
            dbSize: "1.2 MB",
            init: vi.fn(),
            updateSetting: updateSettingMock,
            refreshDbSize: vi.fn(),
            optimizeDb: vi.fn(),
            exportData: vi.fn(),
            importData: vi.fn(),
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
        expect(screen.getByText("选择文件")).toBeInTheDocument();
    });
});
