/**
 * ColorPickerModal Page Object — 颜色选择器
 */

import { waitForDisplayed, waitForHidden } from "../waits.js";
import { observePause } from "../config.js";

class ColorPickerModal {
  get modal() { return "[data-testid='color-picker-modal']"; }
  get preview() { return "[data-testid='color-picker-preview']"; }
  get hexInput() { return "[data-testid='color-picker-hex-input']"; }
  get palette() { return "[data-testid='color-picker-palette']"; }
  get nameInput() { return "[data-testid='color-picker-name-input']"; }
  get confirmBtn() { return "[data-testid='color-picker-confirm-btn']"; }
  get cancelBtn() { return "[data-testid='color-picker-cancel-btn']"; }

  async isOpen() {
    const el = await $(this.modal);
    return el.isExisting() && el.isDisplayed();
  }

  async waitOpen(timeout = 5000) {
    await waitForDisplayed(this.modal, timeout);
  }

  async getPreviewBackground() {
    const el = await $(this.preview);
    return el.getCSSProperty("background-color");
  }

  async setHexValue(hex) {
    const input = await $(this.hexInput);
    await input.clearValue();
    await input.setValue(hex);
    await observePause();
  }

  async getHexValue() {
    const input = await $(this.hexInput);
    return input.getValue();
  }

  async selectPaletteColor(hex) {
    const swatch = await $(`[data-testid='color-picker-swatch'][data-color='${hex}']`);
    await swatch.click();
    await observePause();
  }

  async setColorName(name) {
    const input = await $(this.nameInput);
    await input.clearValue();
    await input.setValue(name);
    await observePause();
  }

  async confirm() {
    await $(this.confirmBtn).then(b => b.click());
    await observePause();
  }

  async cancel() {
    await $(this.cancelBtn).then(b => b.click());
    await observePause();
  }
}

export default new ColorPickerModal();
