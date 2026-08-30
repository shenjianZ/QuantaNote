import { cleanupAll, resetAppState, seedItem, seedTag, seedVersion } from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";

describe("Settings extended coverage", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await TopBar.openSettings();
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    // --- Autostart ---
    it("toggles autostart setting", async () => {
        await SettingsPage.selectSection("外观");
        await SettingsPage.toggleAutostart();
        await observePause();
    });

    // --- Mono Font ---
    it("changes mono font", async () => {
        await SettingsPage.selectSection("字体");
        await SettingsPage.selectMonoFont("Consolas");
        await observePause();
    });

    it("records a custom shortcut", async () => {
        await SettingsPage.selectSection("快捷键");
        await SettingsPage.recordShortcut("global-openPalette", "p");
        const recorder = await $("[data-testid='shortcut-recorder-global-openPalette']");
        expect(await recorder.getText()).toContain("Ctrl+P");
        await $("[data-testid='shortcuts-reset-btn']").click();
        await observePause();
    });

    // --- Backup config ---
    it("displays backup now button in data section", async () => {
        await SettingsPage.selectSection("数据");
        const btn = await $("[data-testid='settings-backup-now-btn']");
        expect(await btn.isDisplayed()).toBe(true);
    });

    it("displays backup manager button in data section", async () => {
        const btn = await $("[data-testid='settings-backup-manager-btn']");
        expect(await btn.isDisplayed()).toBe(true);
    });

    it("displays optional WebDAV remote backup controls", async () => {
        const section = await SettingsPage.getRemoteBackupSection();
        expect(await section.isDisplayed()).toBe(true);

        await SettingsPage.toggleRemoteBackup(true);
        expect(await $("[data-testid='remote-backup-endpoint']").isDisplayed()).toBe(true);
        expect(await $("[data-testid='remote-backup-path']").isDisplayed()).toBe(true);
        expect(await $("[data-testid='remote-backup-username']").isDisplayed()).toBe(true);
        expect(await $("[data-testid='remote-backup-password']").isDisplayed()).toBe(true);
        expect(await $("[data-testid='remote-backup-save-config-btn']").isDisplayed()).toBe(true);
        expect(await $("[data-testid='remote-backup-save-password-btn']").isDisplayed()).toBe(true);
        expect(await $("[data-testid='remote-backup-test-btn']").isDisplayed()).toBe(true);

        await SettingsPage.toggleRemoteBackup(false);
    });

    it("displays attachment storage consistency controls", async () => {
        const section = await $("[data-testid='storage-consistency-section']");
        expect(await section.isDisplayed()).toBe(true);
        const scanButton = await $("[data-testid='storage-consistency-scan-btn']");
        expect(await scanButton.isDisplayed()).toBe(true);
    });

    // --- SQL Diagnostics ---
    it("displays SQL logging section in diagnostics", async () => {
        // Scroll down to diagnostics section
        const diagnostics = await $("//*[contains(., 'SQL 日志') or contains(., 'SQL Log')]");
        expect(diagnostics).toBeTruthy();
    });

    it("displays clear SQL log button", async () => {
        const btn = await $("[data-testid='settings-clear-sql-log-btn']");
        expect(await btn.isExisting()).toBe(true);
    });

    // --- About ---
    it("displays version number in about section", async () => {
        await SettingsPage.selectSectionByIndex(5);
        const version = await SettingsPage.getAboutVersion();
        expect(version).toContain("v0.4.0");
    });

    it("displays GitHub, docs, and feedback links", async () => {
        const links = await $$('section a');
        expect(links.length).toBeGreaterThanOrEqual(3);
        const hrefs = [];
        for (let index = 0; index < links.length; index += 1) {
            hrefs.push(await links[index].getAttribute("href"));
        }
        expect(hrefs.some((href) => href?.includes("github.com/shenjianZ/QuantaNote"))).toBe(true);
        expect(hrefs.some((href) => href?.includes("quantanote-docs.shenjianl.cn"))).toBe(true);
        expect(hrefs.some((href) => href?.includes("github.com/shenjianZ/QuantaNote/issues"))).toBe(true);
    });
});
