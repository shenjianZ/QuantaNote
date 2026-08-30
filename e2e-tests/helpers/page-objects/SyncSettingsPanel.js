/**
 * SyncSettingsPanel Page Object — 同步设置面板
 */

import { waitForDisplayed } from "../waits.js";
import { observePause } from "../config.js";

class SyncSettingsPanel {
  get syncToggle() { return "[data-testid='sync-toggle']"; }
  get serverUrlInput() { return "[data-testid='sync-server-url-input']"; }
  get testConnectionBtn() { return "[data-testid='sync-test-connection-btn']"; }
  get testResult() { return "[data-testid='sync-test-result']"; }
  get loginBtn() { return "[data-testid='sync-login-btn']"; }
  get registerBtn() { return "[data-testid='sync-register-btn']"; }
  get logoutBtn() { return "[data-testid='sync-logout-btn']"; }
  get autoSyncToggle() { return "[data-testid='sync-auto-sync-toggle']"; }
  get intervalInput() { return "[data-testid='sync-interval-input']"; }
  get attachmentsToggle() { return "[data-testid='sync-attachments-toggle']"; }
  get conflictSelect() { return "[data-testid='sync-conflict-select']"; }
  get syncNowBtn() { return "[data-testid='sync-now-btn']"; }
  get syncPauseBtn() { return "[data-testid='sync-pause-btn']"; }
  get syncResumeBtn() { return "[data-testid='sync-resume-btn']"; }
  get syncQueueStatus() { return "[data-testid='sync-queue-status']"; }
  get syncStatus() { return "[data-testid='sync-status']"; }
  get devicesSection() { return "[data-testid='sync-devices']"; }
  get devicesRefreshBtn() { return "[data-testid='sync-devices-refresh-btn']"; }
  get deviceRows() { return "[data-testid='sync-device-row']"; }
  get deviceRevokeBtns() { return "[data-testid='sync-device-revoke-btn']"; }
  get syncError() { return "[data-testid='sync-error']"; }

  async isTogglePresent() {
    const el = await $(this.syncToggle);
    return el.isExisting();
  }

  async isToggleChecked() {
    const el = await $(this.syncToggle);
    return el.isSelected();
  }

  async clickToggle() {
    // Click the visual toggle (the label/div after the hidden checkbox)
    const toggle = await $(this.syncToggle);
    const label = await toggle.parentElement();
    await label.click();
    await observePause();
  }

  async setServerUrl(url) {
    const input = await $(this.serverUrlInput);
    await input.clearValue();
    await input.setValue(url);
    await input.addValue("Tab");
    await observePause();
  }

  async isTestConnectionDisabled() {
    const btn = await $(this.testConnectionBtn);
    return !(await btn.isEnabled());
  }

  async clickTestConnection() {
    await $(this.testConnectionBtn).then(b => b.click());
    await observePause();
  }

  async getTestResultText() {
    const el = await $(this.testResult);
    if (!(await el.isExisting())) return null;
    return el.getText();
  }

  async isLoginBtnVisible() {
    const el = await $(this.loginBtn);
    return el.isExisting() && el.isDisplayed();
  }

  async isRegisterBtnVisible() {
    const el = await $(this.registerBtn);
    return el.isExisting() && el.isDisplayed();
  }

  async clickLogin() {
    await $(this.loginBtn).then(b => b.click());
    await observePause();
  }

  async clickRegister() {
    await $(this.registerBtn).then(b => b.click());
    await observePause();
  }

  async isLogoutBtnVisible() {
    const el = await $(this.logoutBtn);
    return el.isExisting() && el.isDisplayed();
  }

  async isAutoSyncToggleVisible() {
    const el = await $(this.autoSyncToggle);
    return el.isExisting() && el.isDisplayed();
  }

  async isAttachmentsToggleVisible() {
    const el = await $(this.attachmentsToggle);
    return el.isExisting() && el.isDisplayed();
  }

  async getConflictSelectValue() {
    const el = await $(this.conflictSelect);
    return el.getValue();
  }

  async isSyncNowBtnVisible() {
    const el = await $(this.syncNowBtn);
    return el.isExisting() && el.isDisplayed();
  }

  async isLoggedIn() {
    return this.isLogoutBtnVisible();
  }

  async isDevicesSectionVisible() {
    const el = await $(this.devicesSection);
    return el.isExisting() && el.isDisplayed();
  }

  async getDeviceRowsCount() {
    return (await $$(this.deviceRows)).length;
  }
}

export default new SyncSettingsPanel();
