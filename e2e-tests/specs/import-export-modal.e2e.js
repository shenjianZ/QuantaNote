import { cleanupAll, seedItem, seedTag, seedVersion } from "../helpers/commands.js";
import { observePause, pause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import SettingsPage from "../helpers/page-objects/SettingsPage.js";
import ExportModal from "../helpers/page-objects/ExportModal.js";
import ImportModal from "../helpers/page-objects/ImportModal.js";

describe("Import/Export modal UI", () => {
    before(async () => {
        await cleanupAll();
        await seedItem({ title: "导出测试笔记", content: "导出内容" });
        await seedTag("导出测试标签", "cyan");
        await TopBar.openSettings();
        await SettingsPage.selectSection("数据");
    });

    after(async () => {
        await cleanupAll();
    });

    // --- Export Modal ---
    it("opens export modal from data section", async () => {
        await SettingsPage.clickExport();
        await ExportModal.waitOpen();
        expect(await ExportModal.isOpen()).toBe(true);
    });

    it("shows all three inclusion checkboxes checked by default", async () => {
        expect(await ExportModal.isIncludeTagsChecked()).toBe(true);
        expect(await ExportModal.isIncludeAttachmentsChecked()).toBe(true);
        expect(await ExportModal.isIncludeVersionsChecked()).toBe(true);
    });

    it("unchecking tags checkbox works", async () => {
        await ExportModal.toggleIncludeTags();
        expect(await ExportModal.isIncludeTagsChecked()).toBe(false);
        // Toggle back
        await ExportModal.toggleIncludeTags();
    });

    it("unchecking attachments checkbox works", async () => {
        await ExportModal.toggleIncludeAttachments();
        expect(await ExportModal.isIncludeAttachmentsChecked()).toBe(false);
        await ExportModal.toggleIncludeAttachments();
    });

    it("unchecking versions checkbox works", async () => {
        await ExportModal.toggleIncludeVersions();
        expect(await ExportModal.isIncludeVersionsChecked()).toBe(false);
        await ExportModal.toggleIncludeVersions();
    });

    it("closes export modal via cancel button", async () => {
        await ExportModal.close();
        expect(await ExportModal.isOpen()).toBe(false);
    });

    // --- Import Modal ---
    it("opens import modal from data section", async () => {
        await SettingsPage.clickImport();
        await ImportModal.waitOpen();
        expect(await ImportModal.isOpen()).toBe(true);
    });

    it("shows all three inclusion checkboxes checked by default", async () => {
        expect(await ImportModal.isIncludeTagsChecked()).toBe(true);
        expect(await ImportModal.isIncludeAttachmentsChecked()).toBe(true);
        expect(await ImportModal.isIncludeVersionsChecked()).toBe(true);
    });

    it("skip existing is selected by default", async () => {
        expect(await ImportModal.isConflictSkipSelected()).toBe(true);
    });

    it("can switch to overwrite conflict resolution", async () => {
        await ImportModal.selectConflictOverwrite();
        expect(await ImportModal.isConflictOverwriteSelected()).toBe(true);
        expect(await ImportModal.isConflictSkipSelected()).toBe(false);
    });

    it("closes import modal via cancel button", async () => {
        await ImportModal.close();
        expect(await ImportModal.isOpen()).toBe(false);
    });
});
