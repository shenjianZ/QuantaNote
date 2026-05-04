/**
 * AuthModals Page Object — 登录/注册/忘记密码/重置密码
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause } from "../config.js";

class AuthModals {
  // --- Login ---
  get loginModal() { return "[data-testid='login-modal']"; }
  get loginEmailInput() { return "[data-testid='login-email-input']"; }
  get loginPasswordInput() { return "[data-testid='login-password-input']"; }
  get loginServerUrlInput() { return "[data-testid='login-server-url-input']"; }
  get loginSubmitBtn() { return "[data-testid='login-submit-btn']"; }
  get loginError() { return "[data-testid='login-error']"; }
  get loginSwitchToRegister() { return "[data-testid='login-switch-to-register']"; }
  get loginSwitchToForgot() { return "[data-testid='login-switch-to-forgot']"; }

  async isLoginOpen() {
    const el = await $(this.loginModal);
    return el.isDisplayed();
  }

  async fillLoginForm(email, password) {
    const emailInput = await $(this.loginEmailInput);
    const pwInput = await $(this.loginPasswordInput);
    await emailInput.setValue(email);
    await pwInput.setValue(password);
    await observePause();
  }

  async isLoginSubmitDisabled() {
    const btn = await $(this.loginSubmitBtn);
    return !(await btn.isEnabled());
  }

  async clickLoginSubmit() {
    await $(this.loginSubmitBtn).then(b => b.click());
    await observePause();
  }

  async clickSwitchToRegister() {
    await $(this.loginSwitchToRegister).then(b => b.click());
    await observePause();
  }

  async clickSwitchToForgot() {
    await $(this.loginSwitchToForgot).then(b => b.click());
    await observePause();
  }

  async hasServerUrlInput() {
    const el = await $(this.loginServerUrlInput);
    return el.isExisting();
  }

  // --- Register ---
  get registerModal() { return "[data-testid='register-modal']"; }
  get registerEmailInput() { return "[data-testid='register-email-input']"; }
  get registerPasswordInput() { return "[data-testid='register-password-input']"; }
  get registerConfirmPasswordInput() { return "[data-testid='register-confirm-password-input']"; }
  get registerSubmitBtn() { return "[data-testid='register-submit-btn']"; }
  get registerError() { return "[data-testid='register-error']"; }
  get registerSwitchToLogin() { return "[data-testid='register-switch-to-login']"; }

  async isRegisterOpen() {
    const el = await $(this.registerModal);
    return el.isDisplayed();
  }

  async fillRegisterForm(email, password, confirmPassword) {
    const emailInput = await $(this.registerEmailInput);
    const pwInput = await $(this.registerPasswordInput);
    const cpwInput = await $(this.registerConfirmPasswordInput);
    await emailInput.setValue(email);
    await pwInput.setValue(password);
    await cpwInput.setValue(confirmPassword);
    await observePause();
  }

  async isRegisterSubmitDisabled() {
    const btn = await $(this.registerSubmitBtn);
    return !(await btn.isEnabled());
  }

  async clickRegisterSubmit() {
    await $(this.registerSubmitBtn).then(b => b.click());
    await observePause();
  }

  async clickSwitchToLogin() {
    await $(this.registerSwitchToLogin).then(b => b.click());
    await observePause();
  }

  // --- Forgot Password ---
  get forgotModal() { return "[data-testid='forgot-password-modal']"; }
  get forgotEmailInput() { return "[data-testid='forgot-email-input']"; }
  get forgotSubmitBtn() { return "[data-testid='forgot-submit-btn']"; }
  get forgotSuccess() { return "[data-testid='forgot-success']"; }
  get forgotError() { return "[data-testid='forgot-error']"; }
  get forgotSwitchToLogin() { return "[data-testid='forgot-switch-to-login']"; }

  async isForgotOpen() {
    const el = await $(this.forgotModal);
    return el.isDisplayed();
  }

  async fillForgotForm(email) {
    const input = await $(this.forgotEmailInput);
    await input.setValue(email);
    await observePause();
  }

  async isForgotSubmitDisabled() {
    const btn = await $(this.forgotSubmitBtn);
    return !(await btn.isEnabled());
  }

  async clickForgotSubmit() {
    await $(this.forgotSubmitBtn).then(b => b.click());
    await observePause();
  }

  async isForgotSuccessVisible() {
    const el = await $(this.forgotSuccess);
    return el.isExisting() && el.isDisplayed();
  }

  async clickForgotSwitchToLogin() {
    await $(this.forgotSwitchToLogin).then(b => b.click());
    await observePause();
  }

  // --- Reset Password ---
  get resetModal() { return "[data-testid='reset-password-modal']"; }
  get resetTokenInput() { return "[data-testid='reset-token-input']"; }
  get resetNewPasswordInput() { return "[data-testid='reset-new-password-input']"; }
  get resetConfirmPasswordInput() { return "[data-testid='reset-confirm-password-input']"; }
  get resetSubmitBtn() { return "[data-testid='reset-submit-btn']"; }
  get resetError() { return "[data-testid='reset-error']"; }
  get resetSuccess() { return "[data-testid='reset-success']"; }
  get resetSwitchToLogin() { return "[data-testid='reset-switch-to-login']"; }

  async isResetOpen() {
    const el = await $(this.resetModal);
    return el.isDisplayed();
  }

  async isResetSubmitDisabled() {
    const btn = await $(this.resetSubmitBtn);
    return !(await btn.isEnabled());
  }
}

export default new AuthModals();
