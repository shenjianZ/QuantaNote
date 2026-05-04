import { cleanupAll, seedItem, seedVersion } from "../helpers/commands.js";
import { observePause, pause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";
import VersionDiffModal from "../helpers/page-objects/VersionDiffModal.js";

describe("Version diff modal", () => {
    let testItem;

    before(async () => {
        await cleanupAll();
        testItem = await seedItem({ title: "版本对比测试", content: "初始内容行1\n初始内容行2" });
        await seedVersion(testItem.id, "版本A内容行1\n版本A内容行2\n版本A新增行3", "版本A", "第一个版本");
        await seedVersion(testItem.id, "版本B内容行1\n版本B修改行2\n版本B新增行3\n版本B新增行4", "版本B", "第二个版本");
        await TopBar.navLibrary();
        await LibraryPage.clickItem("版本对比测试");
        await LibraryPage.clickEdit();
        await DocumentEditorPage.openVersionPanel();
    });

    after(async () => {
        await cleanupAll();
    });

    it("enters compare mode and shows checkboxes", async () => {
        await DocumentEditorPage.toggleCompareMode();
        const checkboxes = await $$("[data-testid='version-panel-checkbox']");
        expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });

    it("selects two versions and clicks compare to open diff modal", async () => {
        await DocumentEditorPage.selectVersionCheckbox(0);
        await DocumentEditorPage.selectVersionCheckbox(1);
        await DocumentEditorPage.clickCompareBtn();
        await VersionDiffModal.waitOpen();
        expect(await VersionDiffModal.isOpen()).toBe(true);
    });

    it("displays diff stats with added and removed line counts", async () => {
        const statsText = await VersionDiffModal.getStatsText();
        expect(statsText).toBeTruthy();
        // Should contain +N and -N
        expect(statsText).toContain("+");
        expect(statsText).toContain("-");
    });

    it("shows diff content", async () => {
        const content = await VersionDiffModal.getDiffContentText();
        expect(content.length).toBeGreaterThan(0);
    });

    it("closes diff modal via close button", async () => {
        await VersionDiffModal.close();
        expect(await VersionDiffModal.isOpen()).toBe(false);
    });
});
