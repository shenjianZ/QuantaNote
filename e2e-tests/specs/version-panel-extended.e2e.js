import { cleanupAll, seedItem, seedVersion, deleteVersion, getVersions } from "../helpers/commands.js";
import { observePause, pause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";
import VersionDiffModal from "../helpers/page-objects/VersionDiffModal.js";

describe("Version panel extended", () => {
    let testItem;

    before(async () => {
        await cleanupAll();
        testItem = await seedItem({ title: "版本面板测试", content: "内容" });
        await seedVersion(testItem.id, "内容V1", "搜索版本Alpha", "第一个");
        await seedVersion(testItem.id, "内容V2", "搜索版本Beta", "第二个");
        await seedVersion(testItem.id, "内容V3", "其他版本Gamma", "第三个");
        await TopBar.navLibrary();
        await LibraryPage.clickItem("版本面板测试");
        await LibraryPage.clickEdit();
        await DocumentEditorPage.openVersionPanel();
    });

    after(async () => {
        await cleanupAll();
    });

    it("shows all seeded versions in the panel", async () => {
        const count = await DocumentEditorPage.getVersionEntryCount();
        expect(count).toBeGreaterThanOrEqual(3);
    });

    it("search filters versions by name", async () => {
        await DocumentEditorPage.searchVersions("搜索");
        await pause(500);
        const count = await DocumentEditorPage.getVersionEntryCount();
        expect(count).toBe(2); // Alpha and Beta
        // Clear search
        await DocumentEditorPage.searchVersions("");
    });

    it("search with no match shows zero entries", async () => {
        await DocumentEditorPage.searchVersions("ZZZZNONEXIST");
        await pause(500);
        const count = await DocumentEditorPage.getVersionEntryCount();
        expect(count).toBe(0);
        // Clear search
        await DocumentEditorPage.searchVersions("");
    });

    it("compare mode shows checkboxes on each version", async () => {
        await DocumentEditorPage.toggleCompareMode();
        const checkboxes = await $$("[data-testid='version-panel-checkbox']");
        expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    });

    it("selecting two versions and clicking compare opens diff modal", async () => {
        await DocumentEditorPage.selectVersionCheckbox(0);
        await DocumentEditorPage.selectVersionCheckbox(1);
        await DocumentEditorPage.clickCompareBtn();
        await VersionDiffModal.waitOpen();
        expect(await VersionDiffModal.isOpen()).toBe(true);
        await VersionDiffModal.close();
    });

    it("deletes a version via delete confirmation", async () => {
        // Exit compare mode first
        await DocumentEditorPage.toggleCompareMode();
        const countBefore = await DocumentEditorPage.getVersionEntryCount();
        await DocumentEditorPage.clickDeleteVersion(0);
        await observePause();
        await DocumentEditorPage.clickDeleteConfirm();
        await pause(500);
        const countAfter = await DocumentEditorPage.getVersionEntryCount();
        expect(countAfter).toBeLessThan(countBefore);
    });
});
