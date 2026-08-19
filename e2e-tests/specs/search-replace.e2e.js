import { cleanupAll, getItemById, seedItem } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";
import SearchReplaceBar from "../helpers/page-objects/SearchReplaceBar.js";
import { waitForVditorReady } from "../helpers/waits.js";

async function completeInitialLanguageSetup() {
    await browser.waitUntil(
        async () => browser.execute(() => {
            const hasNavigation = Boolean(document.querySelector("[data-testid='nav-library']"));
            const hasLanguageSetup = Array.from(document.querySelectorAll("button")).some((button) => {
                return /开始使用|Get Started/.test(button.textContent || "");
            });
            return hasNavigation || hasLanguageSetup;
        }),
        { timeout: 10000, timeoutMsg: "Application did not reach the main shell or language setup" },
    );

    const continueButton = await $("//button[contains(., '开始使用') or contains(., 'Get Started')]");
    if (await continueButton.isExisting()) {
        const chineseButton = await $("//button[contains(., '简体中文')]");
        if (await chineseButton.isExisting()) await chineseButton.click();
        await continueButton.click();
        await browser.waitUntil(
            async () => browser.execute(() => Boolean(document.querySelector("[data-testid='nav-library']"))),
            { timeout: 10000, timeoutMsg: "Language setup did not transition to the main shell" },
        );
    }
}

describe("Search and replace bar", () => {
    let testItem;

    before(async () => {
        await completeInitialLanguageSetup();
        await cleanupAll();
        testItem = await seedItem({
            title: "搜索替换测试",
            content: "搜索测试内容AAAA 搜索测试内容BBBB 搜索测试内容CCCC",
        });
        await TopBar.navLibrary();
        await LibraryPage.clickItem("搜索替换测试");
        await LibraryPage.clickEdit();
        await waitForVditorReady();
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

    it("persists a single replacement to the document", async () => {
        await SearchReplaceBar.search("AAAA");
        await SearchReplaceBar.setReplace("单次替换");
        await SearchReplaceBar.clickReplace();

        await browser.waitUntil(
            async () => {
                const item = await getItemById(testItem.id);
                return item.content.includes("单次替换") && !item.content.includes("AAAA");
            },
            { timeout: 5000, timeoutMsg: "Single replacement was not persisted" },
        );
    });

    it("persists replace-all changes to the document", async () => {
        await DocumentEditorPage.setContent("批量 AAA 批量 AAA");
        await SearchReplaceBar.search("AAA");
        await SearchReplaceBar.setReplace("全部替换");
        await SearchReplaceBar.clickReplaceAll();

        await browser.waitUntil(
            async () => {
                const item = await getItemById(testItem.id);
                return item.content.trim() === "批量 全部替换 批量 全部替换";
            },
            { timeout: 5000, timeoutMsg: "Replace-all changes were not persisted" },
        );
    });

    it("close button closes the search bar", async () => {
        await SearchReplaceBar.close();
        expect(await SearchReplaceBar.isOpen()).toBe(false);
    });
});
