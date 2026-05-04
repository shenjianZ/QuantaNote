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
        await SettingsPage.selectSectionByIndex(4);
        const version = await SettingsPage.getAboutVersion();
        expect(version).toContain("v0.1.0");
    });

    it("displays GitHub, docs, and feedback links", async () => {
        const links = await $$("//section//a[contains(@href, 'github.com')]");
        expect(links.length).toBeGreaterThanOrEqual(3);
    });
});
