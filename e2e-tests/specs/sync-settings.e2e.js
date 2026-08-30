import {
    cleanupAll,
    getSyncConfig,
    getSyncQueueStatus,
    pauseSync,
    resetAppState,
    resumeSync,
    saveSyncConfig,
} from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import SyncSettingsPanel from "../helpers/page-objects/SyncSettingsPanel.js";

async function openProfileLogin() {
    await TopBar.openAccount();
    const btn = await $("//button[normalize-space(.)='登录']");
    await btn.click();
    await observePause();
}

async function openProfileRegister() {
    await TopBar.openAccount();
    const btn = await $("//button[normalize-space(.)='注册']");
    await btn.click();
    await observePause();
}

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

    it("keeps account actions in the profile entry", async () => {
        expect(await SyncSettingsPanel.isLoginBtnVisible()).toBe(false);
        expect(await SyncSettingsPanel.isRegisterBtnVisible()).toBe(false);
    });

    it("hides device sessions while signed out", async () => {
        expect(await SyncSettingsPanel.isDevicesSectionVisible()).toBe(false);
    });

    it("test connection button is disabled when URL is empty", async () => {
        expect(await SyncSettingsPanel.isTestConnectionDisabled()).toBe(true);
    });

    it("entering URL enables test connection button", async () => {
        await SyncSettingsPanel.setServerUrl("https://test-server.example.com");
        expect(await SyncSettingsPanel.isTestConnectionDisabled()).toBe(false);
    });

    it("profile entry opens login modal", async () => {
        await SyncSettingsPanel.setServerUrl("https://test-server.example.com");
        await openProfileLogin();
        const loginModal = await $("[data-testid='login-modal']");
        expect(await loginModal.isDisplayed()).toBe(true);
        await browser.keys("Escape");
        await observePause();
    });

    it("profile entry opens register modal", async () => {
        await openProfileRegister();
        const registerModal = await $("[data-testid='register-modal']");
        expect(await registerModal.isDisplayed()).toBe(true);
        await browser.keys("Escape");
        await observePause();
    });

    it("does not persist plaintext tokens submitted by the frontend", async () => {
        await saveSyncConfig({
            enabled: true,
            server_url: "https://test-server.example.com",
            access_token: "mock-token",
            refresh_token: "mock-refresh-token",
            user_id: "mock-user",
            device_id: "mock-device",
            auto_sync: false,
            sync_interval_minutes: 15,
            sync_attachments: true,
            conflict_resolution: "auto",
            last_sync_at: null,
            last_snapshot_id: null,
        });
        const config = await getSyncConfig();
        expect(config.access_token).toBeUndefined();
        expect(config.refresh_token).toBeUndefined();
        expect(config.authenticated).toBe(false);
    });

    it("persists pause and resume state for the offline queue", async () => {
        await pauseSync();
        expect((await getSyncQueueStatus()).paused).toBe(true);
        await resumeSync();
        const queue = await getSyncQueueStatus();
        expect(queue.paused).toBe(false);
        expect(queue.next_retry_at).toBe(null);
    });
});
