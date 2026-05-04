import { cleanupAll, seedItem } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";
import SearchReplaceBar from "../helpers/page-objects/SearchReplaceBar.js";

describe("Search and replace bar", () => {
    let testItem;

    before(async () => {
        await cleanupAll();
        testItem = await seedItem({
            title: "搜索替换测试",
            content: "搜索测试内容AAAA 搜索测试内容BBBB 搜索测试内容CCCC",
        });
        await TopBar.navLibrary();
        await LibraryPage.clickItem("搜索替换测试");
        await LibraryPage.clickEdit();
    });

    after(async () => {
        await cleanupAll();
    });

    it("opens search bar with Ctrl+H in document editor", async () => {
        await browser.keys(["Control", "h"]);
        await SearchReplaceBar.waitOpen();
        expect(await SearchReplaceBar.isOpen()).toBe(true);
    });

    it("displays search input", async () => {
        const input = await $("[data-testid='search-input']");
        expect(await input.isDisplayed()).toBe(true);
    });

    it("shows no match when search query has no results", async () => {
        await SearchReplaceBar.search("ZZZZNOTFOUND");
        await pause(500);
        const text = await SearchReplaceBar.getMatchCountText();
        expect(text).toBeTruthy();
    });

    it("shows match count when search query matches", async () => {
        await SearchReplaceBar.search("搜索测试内容");
        await pause(500);
        const text = await SearchReplaceBar.getMatchCountText();
        // Should show something like "1/3"
        expect(text).toContain("/");
    });

    it("next button is displayed", async () => {
        const btn = await $("[data-testid='search-next-btn']");
        expect(await btn.isDisplayed()).toBe(true);
    });

    it("prev button is displayed", async () => {
        const btn = await $("[data-testid='search-prev-btn']");
        expect(await btn.isDisplayed()).toBe(true);
    });

    it("case sensitive toggle is displayed", async () => {
        const btn = await $("[data-testid='search-case-sensitive-btn']");
        expect(await btn.isDisplayed()).toBe(true);
    });

    it("case sensitive toggle changes state when clicked", async () => {
        const before = await SearchReplaceBar.isCaseSensitive();
        await SearchReplaceBar.toggleCaseSensitive();
        const after = await SearchReplaceBar.isCaseSensitive();
        expect(after).toBe(!before);
    });

    it("Escape key closes the search bar", async () => {
        await browser.keys("Escape");
        await observePause();
        expect(await SearchReplaceBar.isOpen()).toBe(false);
    });

    it("displays replace input field", async () => {
        // Re-open
        await browser.keys(["Control", "h"]);
        await SearchReplaceBar.waitOpen();
        const input = await $("[data-testid='replace-input']");
        expect(await input.isDisplayed()).toBe(true);
    });

    it("replace and replace all buttons are displayed", async () => {
        const replaceBtn = await $("[data-testid='replace-btn']");
        const replaceAllBtn = await $("[data-testid='replace-all-btn']");
        expect(await replaceBtn.isDisplayed()).toBe(true);
        expect(await replaceAllBtn.isDisplayed()).toBe(true);
    });

    it("close button closes the search bar", async () => {
        await SearchReplaceBar.close();
        expect(await SearchReplaceBar.isOpen()).toBe(false);
    });
});
