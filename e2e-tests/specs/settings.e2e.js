import { cleanupAll, resetAppState } from "../helpers/commands.js";
import { pause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";

describe("Settings deep coverage", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await TopBar.openSettings();
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    it("changes font family", async () => {
        await SettingsPage.selectSection("字体");
        await SettingsPage.selectFont("Inter");

        const fontVar = await browser.execute(() =>
            getComputedStyle(document.documentElement)
                .getPropertyValue("--font-sans")
                .trim(),
        );
        expect(fontVar).toContain("Inter");
    });

    it("changes font size with slider", async () => {
        await SettingsPage.setFontSize(16);

        const sizeVar = await browser.execute(() =>
            getComputedStyle(document.documentElement)
                .getPropertyValue("--font-size-base")
                .trim(),
        );
        expect(sizeVar).toBe("16px");
    });

    it("changes accent color", async () => {
        await SettingsPage.selectSection("外观");
        await SettingsPage.setAccentColor(1); // 蓝色

        const accentVar = await SettingsPage.getAccentColor();
        expect(accentVar).toBeTruthy();
        expect(accentVar).not.toBe("");
    });

    it("toggles minimizeToTray setting", async () => {
        await SettingsPage.toggleSetting("最小化到系统托盘");
        const settings = await browser.execute(() => {
            const s = localStorage.getItem("quantanote-settings");
            return s ? JSON.parse(s) : {};
        });
        expect(typeof settings.minimizeToTray).toBe("boolean");
    });

    it("toggles closeKeepRunning setting", async () => {
        await SettingsPage.toggleSetting("关闭窗口时隐藏到托盘");
        const settings = await browser.execute(() => {
            const s = localStorage.getItem("quantanote-settings");
            return s ? JSON.parse(s) : {};
        });
        expect(typeof settings.closeKeepRunning).toBe("boolean");
    });

    it("refreshes db size", async () => {
        await SettingsPage.selectSection("数据");
        await pause(500);
        const size = await SettingsPage.getDbSize();
        expect(size).not.toBe("计算中...");
        expect(size.length).toBeGreaterThan(0);
    });

    it("optimizes database", async () => {
        await SettingsPage.clickOptimizeDb();
        // 优化不应报错，页面应仍正常显示
        const size = await SettingsPage.getDbSize();
        expect(size.length).toBeGreaterThan(0);
    });

    it("theme change persists", async () => {
        await SettingsPage.selectSection("外观");
        await SettingsPage.setTheme("light");
        let theme = await SettingsPage.getTheme();
        expect(theme).toBe("light");

        // 导航离开再回来
        await TopBar.navLibrary();
        await TopBar.openSettings();
        await SettingsPage.selectSection("外观");
        theme = await SettingsPage.getTheme();
        expect(theme).toBe("light");
    });
});
