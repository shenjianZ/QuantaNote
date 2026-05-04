import { cleanupAll, resetAppState, saveSyncConfig } from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import SyncSettingsPanel from "../helpers/page-objects/SyncSettingsPanel.js";

describe("Sync settings panel", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await TopBar.openSettings();
        await SettingsPage.selectSectionByIndex(3);
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    it("displays sync toggle", async () => {
        expect(await SyncSettingsPanel.isTogglePresent()).toBe(true);
    });

    it("displays server URL input field", async () => {
        const input = await $("[data-testid='sync-server-url-input']");
        expect(await input.isDisplayed()).toBe(true);
    });

    it("displays login and register buttons when not logged in", async () => {
        expect(await SyncSettingsPanel.isLoginBtnVisible()).toBe(true);
        expect(await SyncSettingsPanel.isRegisterBtnVisible()).toBe(true);
    });

    it("test connection button is disabled when URL is empty", async () => {
        expect(await SyncSettingsPanel.isTestConnectionDisabled()).toBe(true);
    });

    it("entering URL enables test connection button", async () => {
        await SyncSettingsPanel.setServerUrl("https://test-server.example.com");
        expect(await SyncSettingsPanel.isTestConnectionDisabled()).toBe(false);
    });

    it("clicking login opens login modal", async () => {
        await SyncSettingsPanel.clickLogin();
        const loginModal = await $("[data-testid='login-modal']");
        expect(await loginModal.isDisplayed()).toBe(true);
        await browser.keys("Escape");
        await observePause();
    });

    it("clicking register opens register modal", async () => {
        await SyncSettingsPanel.clickRegister();
        const registerModal = await $("[data-testid='register-modal']");
        expect(await registerModal.isDisplayed()).toBe(true);
        await browser.keys("Escape");
        await observePause();
    });

    it("sync strategy section appears after simulated login", async () => {
        // Simulate logged-in state by saving sync config with access_token
        await saveSyncConfig({
            enabled: true,
            server_url: "https://test-server.example.com",
            access_token: "mock-token",
            user_id: "mock-user",
            auto_sync: false,
            sync_interval_minutes: 15,
            sync_attachments: true,
            conflict_resolution: "auto",
        });
        await browser.refresh();
        await observePause();
        // Navigate back to sync section
        await TopBar.openSettings();
        await SettingsPage.selectSectionByIndex(3);
        // Now logout button should be visible
        expect(await SyncSettingsPanel.isLogoutBtnVisible()).toBe(true);
    });

    it("auto-sync toggle is visible after login", async () => {
        expect(await SyncSettingsPanel.isAutoSyncToggleVisible()).toBe(true);
    });

    it("conflict resolution dropdown exists", async () => {
        const select = await $("[data-testid='sync-conflict-select']");
        expect(await select.isDisplayed()).toBe(true);
        // Verify options
        const value = await select.getValue();
        expect(value).toBe("auto");
    });

    it("sync now button is visible after login", async () => {
        expect(await SyncSettingsPanel.isSyncNowBtnVisible()).toBe(true);
    });

    it("sync attachments toggle is visible after login", async () => {
        expect(await SyncSettingsPanel.isAttachmentsToggleVisible()).toBe(true);
    });
});
