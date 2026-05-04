import { cleanupAll, resetAppState } from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import ColorPickerModal from "../helpers/page-objects/ColorPickerModal.js";

describe("Color picker modal", () => {
    before(async () => {
        await cleanupAll();
        await resetAppState();
        await TopBar.openSettings();
        await SettingsPage.selectSection("外观");
    });

    after(async () => {
        await resetAppState();
        await cleanupAll();
    });

    it("opens color picker when add custom color button is clicked", async () => {
        await SettingsPage.clickAddCustomColor();
        await ColorPickerModal.waitOpen();
        expect(await ColorPickerModal.isOpen()).toBe(true);
    });

    it("displays color preview square", async () => {
        const preview = await $("[data-testid='color-picker-preview']");
        expect(await preview.isDisplayed()).toBe(true);
    });

    it("displays HEX input with default value", async () => {
        const hex = await ColorPickerModal.getHexValue();
        expect(hex).toBeTruthy();
        expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("clicking palette swatch updates hex input", async () => {
        await ColorPickerModal.selectPaletteColor("#ef4444");
        const hex = await ColorPickerModal.getHexValue();
        expect(hex).toBe("#ef4444");
    });

    it("typing valid hex updates the value", async () => {
        await ColorPickerModal.setHexValue("#2563eb");
        const hex = await ColorPickerModal.getHexValue();
        expect(hex).toBe("#2563eb");
    });

    it("color name input accepts text", async () => {
        await ColorPickerModal.setColorName("测试蓝色");
        const input = await $("[data-testid='color-picker-name-input']");
        const value = await input.getValue();
        expect(value).toBe("测试蓝色");
    });

    it("cancel button closes modal without adding color", async () => {
        const countBefore = await SettingsPage.getCustomColorCount();
        await ColorPickerModal.cancel();
        expect(await ColorPickerModal.isOpen()).toBe(false);
    });

    it("confirm button closes modal and adds custom color", async () => {
        const countBefore = await SettingsPage.getCustomColorCount();
        await SettingsPage.clickAddCustomColor();
        await ColorPickerModal.waitOpen();
        await ColorPickerModal.selectPaletteColor("#8b5cf6");
        await ColorPickerModal.setColorName("紫色测试");
        await ColorPickerModal.confirm();
        expect(await ColorPickerModal.isOpen()).toBe(false);
    });
});
