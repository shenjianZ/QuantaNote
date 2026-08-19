import { cleanupAll, resetAppState, saveSyncConfig } from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import AuthModals from "../helpers/page-objects/AuthModals.js";

async function clickProfileLogin() {
    const btn = await $("//button[normalize-space(.)='登录']");
    await btn.click();
    await observePause();
}

async function clickProfileRegister() {
    const btn = await $("//button[normalize-space(.)='注册']");
    await btn.click();
    await observePause();
}

describe("Auth modals (UI interactions)", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await saveSyncConfig({
            enabled: false,
            server_url: "https://test-server.example.com",
            access_token: "",
            refresh_token: "",
            user_id: "",
            device_id: "",
            auto_sync: false,
            sync_interval_minutes: 15,
            conflict_resolution: "auto",
            sync_attachments: true,
            last_sync_at: null,
            last_snapshot_id: null,
        });
        await browser.refresh();
        await TopBar.openAccount();
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    // --- Login ---
    it("opens login modal when sync login button clicked", async () => {
        await clickProfileLogin();
        expect(await AuthModals.isLoginOpen()).toBe(true);
    });

    it("login form shows email and password fields", async () => {
        const email = await $("[data-testid='login-email-input']");
        const password = await $("[data-testid='login-password-input']");
        expect(await email.isDisplayed()).toBe(true);
        expect(await password.isDisplayed()).toBe(true);
    });

    it("login submit is disabled when fields are empty", async () => {
        expect(await AuthModals.isLoginSubmitDisabled()).toBe(true);
    });

    it("login form can be filled and submit button enables", async () => {
        await AuthModals.fillLoginForm("test@example.com", "password123");
        expect(await AuthModals.isLoginSubmitDisabled()).toBe(false);
    });

    it("login modal switches to register modal via link", async () => {
        // Close current login first, then re-open from sync panel
        await browser.keys("Escape");
        await observePause();
        await clickProfileLogin();
        await AuthModals.clickSwitchToRegister();
        expect(await AuthModals.isRegisterOpen()).toBe(true);
    });

    it("login modal switches to forgot password modal via link", async () => {
        await browser.keys("Escape");
        await observePause();
        await clickProfileLogin();
        await AuthModals.clickSwitchToForgot();
        expect(await AuthModals.isForgotOpen()).toBe(true);
    });

    it("closes login modal via Escape key", async () => {
        await browser.keys("Escape");
        await observePause();
        // Re-open login to test escape close
        await clickProfileLogin();
        expect(await AuthModals.isLoginOpen()).toBe(true);
        await browser.keys("Escape");
        await observePause();
    });

    // --- Register ---
    it("opens register modal when sync register button clicked", async () => {
        await clickProfileRegister();
        expect(await AuthModals.isRegisterOpen()).toBe(true);
    });

    it("register form has email, password, confirm password fields", async () => {
        const email = await $("[data-testid='register-email-input']");
        const password = await $("[data-testid='register-password-input']");
        const confirm = await $("[data-testid='register-confirm-password-input']");
        expect(await email.isDisplayed()).toBe(true);
        expect(await password.isDisplayed()).toBe(true);
        expect(await confirm.isDisplayed()).toBe(true);
    });

    it("register submit is disabled when fields are empty", async () => {
        expect(await AuthModals.isRegisterSubmitDisabled()).toBe(true);
    });

    it("register modal switches to login modal via link", async () => {
        await AuthModals.clickSwitchToLogin();
        expect(await AuthModals.isLoginOpen()).toBe(true);
    });

    // --- Forgot Password ---
    it("opens forgot password modal from login modal link", async () => {
        await browser.keys("Escape");
        await observePause();
        await clickProfileLogin();
        await AuthModals.clickSwitchToForgot();
        expect(await AuthModals.isForgotOpen()).toBe(true);
    });

    it("forgot password form has email input and submit button", async () => {
        const email = await $("[data-testid='forgot-email-input']");
        const btn = await $("[data-testid='forgot-submit-btn']");
        expect(await email.isDisplayed()).toBe(true);
        expect(await btn.isDisplayed()).toBe(true);
    });

    it("forgot password submit is disabled when email empty", async () => {
        expect(await AuthModals.isForgotSubmitDisabled()).toBe(true);
    });

    it("forgot password modal has back to login link", async () => {
        const link = await $("[data-testid='forgot-switch-to-login']");
        expect(await link.isDisplayed()).toBe(true);
    });
});
