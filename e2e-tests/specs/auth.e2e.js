import { cleanupAll, resetAppState } from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import SyncSettingsPanel from "../helpers/page-objects/SyncSettingsPanel.js";
import AuthModals from "../helpers/page-objects/AuthModals.js";

describe("Auth modals (UI interactions)", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await TopBar.openSettings();
        // Navigate to sync section (index 3: Cloud icon)
        await SettingsPage.selectSectionByIndex(3);
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    // --- Login ---
    it("opens login modal when sync login button clicked", async () => {
        await SyncSettingsPanel.clickLogin();
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
        await SyncSettingsPanel.clickLogin();
        await AuthModals.clickSwitchToRegister();
        expect(await AuthModals.isRegisterOpen()).toBe(true);
    });

    it("login modal switches to forgot password modal via link", async () => {
        await browser.keys("Escape");
        await observePause();
        await SyncSettingsPanel.clickLogin();
        await AuthModals.clickSwitchToForgot();
        expect(await AuthModals.isForgotOpen()).toBe(true);
    });

    it("closes login modal via Escape key", async () => {
        await browser.keys("Escape");
        await observePause();
        // Re-open login to test escape close
        await SyncSettingsPanel.clickLogin();
        expect(await AuthModals.isLoginOpen()).toBe(true);
        await browser.keys("Escape");
        await observePause();
    });

    // --- Register ---
    it("opens register modal when sync register button clicked", async () => {
        await SyncSettingsPanel.clickRegister();
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
        await SyncSettingsPanel.clickLogin();
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
