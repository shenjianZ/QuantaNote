import { cleanupAll, resetAppState, saveSyncConfig } from "../helpers/commands.js";
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

    it("sync strategy section appears after simulated login", async () => {
        // Simulate logged-in state by saving sync config with access_token
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
        await browser.refresh();
        await observePause();
        // Navigate back to sync section
        await TopBar.openSettings();
        await SettingsPage.selectSectionByIndex(3);
        // 账号操作位于顶部账号入口，设置页继续显示已登录后的同步策略。
        expect(await SyncSettingsPanel.isLoginBtnVisible()).toBe(false);
        expect(await SyncSettingsPanel.isAutoSyncToggleVisible()).toBe(true);
    });

    it("auto-sync toggle is visible after login", async () => {
        expect(await SyncSettingsPanel.isAutoSyncToggleVisible()).toBe(true);
    });

    it("conflict resolution dropdown exists", async () => {
        const select = await $("//span[contains(normalize-space(.), '冲突解决')]/following-sibling::div//button");
        expect(await select.isDisplayed()).toBe(true);
        // 自定义 Select 使用按钮呈现当前选项，不能通过原生 getValue 读取。
        const text = await select.getText();
        expect(text).toContain("自动");
    });

    it("sync now button is visible after login", async () => {
        expect(await SyncSettingsPanel.isSyncNowBtnVisible()).toBe(true);
    });

    it("sync attachments toggle is visible after login", async () => {
        expect(await SyncSettingsPanel.isAttachmentsToggleVisible()).toBe(true);
    });
});
