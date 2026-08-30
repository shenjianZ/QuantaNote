import { cleanupAll, seedItem, getItemById, getVersions, loadAppSettings, createTestFile, tauriInvoke, notifyDataChanged } from "../helpers/commands.js";
import { pause, observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";
import LibraryPage from "../helpers/page-objects/LibraryPage.js";
import DocumentEditorPage from "../helpers/page-objects/DocumentEditorPage.js";

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

describe("Document editor", () => {
  let testItem;

  before(async () => {
    await completeInitialLanguageSetup();
    await cleanupAll();
    testItem = await seedItem({ title: "编辑器测试笔记", content: "初始内容" });
    const imagePath = await createTestFile(
      "quantanote-editor-reentry.svg",
      "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"80\"><rect width=\"120\" height=\"80\" fill=\"#2563eb\"/></svg>",
    );
    const attachment = await tauriInvoke("add_attachment", { itemId: testItem.id, path: imagePath });
    await tauriInvoke("update_item", {
      id: testItem.id,
      content: `![quantanote-editor-reentry.svg](attachment://${encodeURIComponent(attachment.id)})`,
    });
    await notifyDataChanged();
    await TopBar.navLibrary();
    await LibraryPage.clickItem("编辑器测试笔记");
    await LibraryPage.clickEdit();
    await DocumentEditorPage.setOutlineVisible(true);
  });

  after(async () => {
    await cleanupAll();
  });

  it("loads item title and content in editor", async () => {
    const title = await DocumentEditorPage.getTitle();
    expect(title).toBe("编辑器测试笔记");
  });

  it("auto-saves after 1 second debounce", async () => {
    await DocumentEditorPage.setTitle("自动保存测试");
    await DocumentEditorPage.waitForSaved(3000);

    const updated = await getItemById(testItem.id);
    expect(updated.title).toBe("自动保存测试");
  });

  it("auto-saves summary after 1 second debounce", async () => {
    await DocumentEditorPage.setSummary("手动修改后的摘要");
    await DocumentEditorPage.waitForSaved(3000);

    const updated = await getItemById(testItem.id);
    expect(updated.summary).toBe("手动修改后的摘要");
  });

  it("supports automatic and manual summary modes", async () => {
    await DocumentEditorPage.setSummaryMode("自动摘要");
    await DocumentEditorPage.setContent("自动摘要正文abcdefghijk");
    await DocumentEditorPage.waitForSaved(3000);

    const autoUpdated = await getItemById(testItem.id);
    expect(autoUpdated.summary_mode).toBe("auto");
    expect(autoUpdated.summary).toBe(autoUpdated.content.slice(0, 10));

    await DocumentEditorPage.setSummary("固定摘要内容");
    await DocumentEditorPage.waitForSaved(3000);
    await DocumentEditorPage.setContent("手动摘要对应的新正文abcdefghijk");
    await DocumentEditorPage.waitForSaved(3000);

    const manualUpdated = await getItemById(testItem.id);
    expect(manualUpdated.summary_mode).toBe("manual");
    expect(manualUpdated.summary).toBe("固定摘要内容");

    await DocumentEditorPage.regenerateSummary();
    await browser.waitUntil(
      async () => {
        const regenerated = await getItemById(testItem.id);
        return regenerated.summary_mode === "auto"
          && regenerated.summary === regenerated.content.slice(0, 10);
      },
      { timeout: 5000, timeoutMsg: "Summary was not regenerated in automatic mode" },
    );
  });

  it("exposes image and attachment insertion controls", async () => {
    await browser.waitUntil(
      async () => DocumentEditorPage.hasImageInsertionToolbar() && DocumentEditorPage.hasAttachmentInsertionToolbar(),
      { timeout: 5000, timeoutMsg: "Image and attachment toolbar buttons did not load" },
    );
    expect(await DocumentEditorPage.hasAttachmentToolbar()).toBe(true);
  });

  it("resolves image attachments after reopening the editor", async () => {
    const hasLoadedImage = async () => browser.execute(() => {
      const image = document.querySelector(".vditor-ir img");
      return Boolean(image && image.complete && image.naturalWidth > 0 && !image.src.startsWith("attachment://"));
    });

    await DocumentEditorPage.clickBack();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => DocumentEditorPage.isDisplayed(),
      { timeout: 5000, timeoutMsg: "Editor did not reopen for attachment rendering check" },
    );
    await browser.waitUntil(hasLoadedImage, {
      timeout: 5000,
      timeoutMsg: "Image attachment was not resolved after reopening the editor",
    });
  });

  it("inserts an attachment at the saved editor cursor position", async () => {
    await DocumentEditorPage.clearContent();
    await DocumentEditorPage.typeContent("前文\n\n后文");
    await DocumentEditorPage.waitForSaved(3000);
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        return updated.content.includes("前文") && updated.content.includes("后文");
      },
      { timeout: 5000, timeoutMsg: "Editor text was not persisted before cursor setup" },
    );
    await browser.execute(() => {
      const editor = document.querySelector(".vditor-ir [contenteditable]");
      if (!editor) throw new Error("Vditor editor not found");
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node && !node.textContent?.includes("前文")) node = walker.nextNode();
      if (!node) throw new Error("Editor text node for cursor position not found");
      const offset = node.textContent.indexOf("前文") + "前文".length;
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    await $("[data-testid='doc-attachments-btn']").click();
    await browser.waitUntil(
      async () => (await $$("[data-testid='attachment-item']")).length === 1,
      { timeout: 3000, timeoutMsg: "Attachment manager did not load the seeded attachment" },
    );
    await $("[data-testid='attachment-insert-btn']").click();
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        const imageIndex = updated.content.indexOf("quantanote-editor-reentry.svg");
        return imageIndex > updated.content.indexOf("前文") && imageIndex < updated.content.indexOf("后文");
      },
      { timeout: 5000, timeoutMsg: "Attachment was not inserted at the saved cursor position" },
    );
  });

  it("edits image metadata and presentation without leaking the local file path", async () => {
    const image = await $(".vditor-ir img[alt='quantanote-editor-reentry.svg']");
    await image.click();
    await browser.waitUntil(
      async () => (await $("[data-testid='image-editor-popover']")).isDisplayed(),
      { timeout: 3000, timeoutMsg: "Image editor popover did not open" },
    );

    const altInput = await $("[data-testid='image-editor-alt']");
    await altInput.clearValue();
    await altInput.setValue("正文截图");
    const widthInput = await $("[data-testid='image-editor-width']");
    await widthInput.clearValue();
    await widthInput.setValue("640");
    await $("[data-testid='image-editor-apply']").click();

    let latestImageContent = "";
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        latestImageContent = updated.content;
        return updated.content.includes("正文截图") && updated.content.includes("qn-width=640");
      },
      { timeout: 5000, timeoutMsg: `Image metadata was not persisted: ${latestImageContent}` },
    );
    const updated = await getItemById(testItem.id);
    expect(updated.content).not.toContain(".quantanote");
    expect(updated.content).not.toMatch(/[A-Za-z]:[\\/].*attachments[\\/]/);

    await DocumentEditorPage.clickBack();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => browser.execute(() => {
        const imageNode = document.querySelector(".vditor-ir img[alt='正文截图']");
        return imageNode?.style.width === "640px";
      }),
      { timeout: 5000, timeoutMsg: "Image presentation was not restored after reopening" },
    );
  });

  it("shows a clear image load error and retries the failed source", async () => {
    await browser.waitUntil(
      async () => $(".vditor-ir img:not(.emoji)").isExisting(),
      { timeout: 5000, timeoutMsg: "Image for retry test did not render" },
    );
    const failedSource = await browser.execute(() => {
      const currentImage = document.querySelector(".vditor-ir img:not(.emoji)");
      if (!currentImage) throw new Error("Image for retry test was not found");
      const source = `http://asset.localhost/missing-image-${Date.now()}.png`;
      currentImage.dataset.e2eRetryErrorCount = "0";
      currentImage.addEventListener("error", () => {
        currentImage.dataset.e2eRetryErrorCount = String(
          Number(currentImage.dataset.e2eRetryErrorCount || "0") + 1,
        );
      });
      currentImage.setAttribute("src", source);
      return source;
    });
    await browser.waitUntil(
      async () => (await $("[data-testid='image-load-error']")).isDisplayed(),
      { timeout: 3000, timeoutMsg: "Image load error state did not appear" },
    );
    await $("[data-testid='image-retry']").click();
    await browser.waitUntil(
      async () => browser.execute((source) => {
        const currentImage = document.querySelector(".vditor-ir img:not(.emoji)");
        return currentImage?.getAttribute("src") === source
          && Number(currentImage?.dataset.e2eRetryErrorCount || "0") >= 2;
      }, failedSource),
      { timeout: 5000, timeoutMsg: "Image retry did not issue a second request for the failed source" },
    );
    await $("[data-testid='image-error-close']").click();
  });

  it("removes inserted image references when its attachment is deleted", async () => {
    await $("[data-testid='doc-attachments-btn']").click();
    await browser.waitUntil(
      async () => (await $$("[data-testid='attachment-item']")).length === 1,
      { timeout: 3000, timeoutMsg: "Attachment manager did not reopen" },
    );
    await $("[data-testid='attachment-item'] button[title='删除附件']").click();
    await browser.waitUntil(
      async () => (await $$("[data-testid='attachment-item']")).length === 0,
      { timeout: 3000, timeoutMsg: "Deleted attachment remained in the manager" },
    );
    await browser.waitUntil(
      async () => browser.execute(() => !document.querySelector(".vditor-ir img")),
      { timeout: 3000, timeoutMsg: "Deleted attachment image remained in the editor" },
    );
    const updated = await getItemById(testItem.id);
    expect(updated.content).not.toContain("attachment://");
    await $("[data-testid='modal-close-btn']").click();
  });

  it("inserts multiple dropped images in selection order", async () => {
    await DocumentEditorPage.clearContent();
    await DocumentEditorPage.typeContent("前文\n\n后文");
    await DocumentEditorPage.waitForSaved(3000);
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        return updated.content.includes("前文") && updated.content.includes("后文");
      },
      { timeout: 5000, timeoutMsg: "Editor text was not persisted before multi-image drop" },
    );
    await browser.execute(() => {
      const editor = document.querySelector(".vditor-ir [contenteditable]");
      if (!editor) throw new Error("Vditor editor not found");
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node && !node.textContent?.includes("前文")) node = walker.nextNode();
      if (!node) throw new Error("Editor text node for drop position not found");
      const offset = node.textContent.indexOf("前文") + "前文".length;
      const range = document.createRange();
      range.setStart(node, offset);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
      Object.defineProperty(dropEvent, "dataTransfer", {
        value: {
          files: [
            new File(["drop-a"], "drop-a.png", { type: "image/png" }),
            new File(["drop-b"], "drop-b.png", { type: "image/png" }),
          ],
        },
      });
      const container = document.querySelector(".vditor-container");
      if (!container) throw new Error("Vditor container not found");
      container.dispatchEvent(dropEvent);
    });

    let latestContent = "";
    try {
      await browser.waitUntil(
        async () => {
          const updated = await getItemById(testItem.id);
          latestContent = updated.content;
          const first = updated.content.indexOf("drop-a.png");
          const second = updated.content.indexOf("drop-b.png");
          return first > updated.content.indexOf("前文")
            && second > first
            && second < updated.content.indexOf("后文");
        },
        { timeout: 8000, timeoutMsg: "Dropped images were not inserted in selection order" },
      );
      await browser.keys("批量后文本");
      await browser.waitUntil(
        async () => {
          const updated = await getItemById(testItem.id);
          const lastImage = updated.content.indexOf("drop-b.png");
          return lastImage >= 0 && updated.content.indexOf("批量后文本") > lastImage;
        },
        { timeout: 5000, timeoutMsg: "Caret did not move after the last dropped image" },
      );
    } catch (error) {
      throw new Error(`${error.message}; latest content: ${latestContent}`);
    }
  });

  it("inserts a table at the editor selection from the toolbar", async () => {
    await DocumentEditorPage.setContent("表格插入位置");
    await browser.execute(() => {
      const editor = document.querySelector(".vditor-ir [contenteditable]");
      if (!editor) throw new Error("Vditor editor not found");
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    await $("button[data-type='quantanote-table']").click();
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(document.querySelector(".quantanote-vditor-table-panel"))),
      { timeout: 2000, timeoutMsg: "Table insertion panel did not open" },
    );
    const inputs = await $$(".quantanote-vditor-table-panel input");
    await inputs[0].clearValue();
    await inputs[0].setValue("2");
    await inputs[1].clearValue();
    await inputs[1].setValue("2");
    await $(".quantanote-vditor-table-panel button.primary").click();

    await browser.waitUntil(
      async () => browser.execute(() => {
        const table = document.querySelector(".vditor-ir table");
        return table?.querySelectorAll("tr").length === 2 && table?.querySelector("tr")?.cells.length === 2;
      }),
      { timeout: 3000, timeoutMsg: "Inserted table was not rendered at the editor selection" },
    );
  });

  it("adjusts an existing table from the toolbar", async () => {
    await DocumentEditorPage.setContent("| A | B |\n| --- | --- |\n| C | D |");
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(document.querySelector(".vditor-ir table tbody td"))),
      { timeout: 8000, timeoutMsg: "Existing table was not rendered" },
    );
    await browser.execute(() => {
      const cell = document.querySelector(".vditor-ir table tbody td");
      const editor = document.querySelector(".vditor-ir [contenteditable]");
      if (!cell || !editor) throw new Error("Existing table cell not found");
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });

    const tableToolbarButton = await $("button[data-type='quantanote-table']");
    await tableToolbarButton.moveTo();
    await browser.waitUntil(
      async () => (await tableToolbarButton.getAttribute("aria-label")) === "调整表格",
      { timeout: 2000, timeoutMsg: "Existing table toolbar tip did not change to edit mode" },
    );
    await tableToolbarButton.click();
    await browser.waitUntil(
      async () => browser.execute(() => document.querySelector(".quantanote-vditor-table-panel")?.textContent?.includes("调整表格") ?? false),
      { timeout: 2000, timeoutMsg: "Existing table edit panel did not open" },
    );
    expect(await $("button[data-table-align='center']").isDisplayed()).toBe(true);
    await $("button[data-table-align='center']").click();

    const inputs = await $$(".quantanote-vditor-table-panel input");
    await inputs[0].clearValue();
    await inputs[0].setValue("3");
    await inputs[1].clearValue();
    await inputs[1].setValue("3");
    await $(".quantanote-vditor-table-panel button.primary").click();

    await browser.waitUntil(
      async () => browser.execute(() => {
        const table = document.querySelector(".vditor-ir table");
        return table?.querySelectorAll("tr").length === 3 && table?.querySelector("tr")?.cells.length === 3;
      }),
      { timeout: 3000, timeoutMsg: "Existing table dimensions were not updated" },
    );
    await DocumentEditorPage.waitForSaved(3000);
    const updated = await getItemById(testItem.id);
    expect(updated.content).toMatch(/\|\s*:-:\s*\|/);

    await browser.execute(() => {
      const cell = document.querySelector(".vditor-ir table tbody td");
      const editor = document.querySelector(".vditor-ir [contenteditable]");
      if (!cell || !editor) throw new Error("Adjusted table cell not found");
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await browser.keys(["Control", "z"]);
    await browser.waitUntil(
      async () => browser.execute(() => {
        const table = document.querySelector(".vditor-ir table");
        return table?.querySelectorAll("tr").length === 2 && table?.querySelector("tr")?.cells.length === 2;
      }),
      { timeout: 3000, timeoutMsg: "Table adjustment was not undoable" },
    );

    await browser.keys(["Control", "y"]);
    await browser.waitUntil(
      async () => browser.execute(() => {
        const table = document.querySelector(".vditor-ir table");
        return table?.querySelectorAll("tr").length === 3 && table?.querySelector("tr")?.cells.length === 3;
      }),
      { timeout: 3000, timeoutMsg: "Table adjustment was not redoable" },
    );
  });

  it("keeps the summary textarea fixed-size", async () => {
    const style = await browser.execute(() => {
      const input = document.querySelector("[data-testid='doc-summary-input']");
      if (!input) throw new Error("Summary input not found");
      const computed = window.getComputedStyle(input);
      return { height: computed.height, minHeight: computed.minHeight, maxHeight: computed.maxHeight, resize: computed.resize };
    });

    expect(style.height).toBe(style.minHeight);
    expect(style.height).toBe(style.maxHeight);
    expect(style.resize).toBe("none");
  });

  it("shows and toggles the live document outline", async () => {
    await DocumentEditorPage.clearContent();
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getContent()).trim() === "",
      { timeout: 3000, timeoutMsg: "Editor did not finish clearing before outline input" },
    );
    await DocumentEditorPage.typeContent("# 一级标题\n\n## 二级标题\n\n### 重复标题\n\n### 重复标题");
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getContent()).includes("一级标题"),
      { timeout: 3000, timeoutMsg: "Editor content did not update from the test fixture" },
    );
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getOutlineItemCount()) === 4,
      { timeout: 3000, timeoutMsg: "Document outline did not update from editor content" },
    );

    expect(await DocumentEditorPage.hasToolbarCharacterCount()).toBe(false);
    await DocumentEditorPage.clickOutlineItem(1);
    await DocumentEditorPage.setOutlineVisible(false);
    expect(await DocumentEditorPage.getOutlineItemCount()).toBe(0);
    await DocumentEditorPage.setOutlineVisible(true);
    expect(await DocumentEditorPage.getOutlineItemCount()).toBe(4);

    await DocumentEditorPage.clearContent();
    await pause(150);
    await DocumentEditorPage.typeContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("supports native copy and paste shortcuts in editor", async () => {
    await DocumentEditorPage.clearContent();
    await pause(150);
    await DocumentEditorPage.typeContent("剪贴板快捷键测试");

    await browser.keys(["Control", "a"]);
    await browser.keys(["Control", "c"]);
    await browser.keys("ArrowRight");
    await browser.keys("Enter");
    await browser.keys(["Control", "v"]);

    await browser.waitUntil(
      async () => {
        const content = await DocumentEditorPage.getContent();
        const matches = content.match(/剪贴板快捷键测试/g) ?? [];
        return matches.length >= 2;
      },
      { timeout: 3000, timeoutMsg: "Editor did not paste copied content" },
    );
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        const matches = updated.content.match(/剪贴板快捷键测试/g) ?? [];
        return matches.length >= 2;
      },
      { timeout: 5000, timeoutMsg: "Pasted editor content was not auto-saved" },
    );

    await DocumentEditorPage.clearContent();
    await DocumentEditorPage.typeContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("keeps editor table border aligned with cells", async () => {
    await DocumentEditorPage.setContent("正文颜色\n\n| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|     |     | 01   |\n|     |     | 01   |");

    await browser.waitUntil(
      async () => {
        return browser.execute(() => Boolean(document.querySelector(".vditor-ir table")));
      },
      { timeout: 3000, timeoutMsg: "Editor table was not rendered" },
    );

    const geometry = await browser.execute(() => {
      const table = document.querySelector(".vditor-ir table");
      const rows = Array.from(table?.querySelectorAll("tr") ?? []);
      const rightmostCells = rows
        .map((row) => row.querySelector(":scope > th:last-child, :scope > td:last-child"))
        .filter(Boolean);
      const tableRect = table?.getBoundingClientRect();
      const lastRight = Math.max(...rightmostCells.map((cell) => cell.getBoundingClientRect().right));
      return {
        tableWidth: tableRect?.width ?? 0,
        trailingGap: tableRect ? tableRect.right - lastRight : 999,
      };
    });

    expect(geometry.tableWidth).toBeGreaterThan(0);
    expect(geometry.trailingGap).toBeLessThan(4);

    const colors = await browser.execute(() => {
      const editor = document.querySelector(".vditor-ir");
      const expected = getComputedStyle(document.body).color;
      const cells = Array.from(editor?.querySelectorAll("td, th") ?? []);
      return {
        expected,
        editor: editor ? getComputedStyle(editor).color : "",
        cells: cells.map((cell) => getComputedStyle(cell).color),
      };
    });

    expect(colors.editor).toBe(colors.expected);
    expect(colors.cells.length).toBeGreaterThan(0);
    expect(colors.cells.every((color) => color === colors.expected)).toBe(true);

    await DocumentEditorPage.setContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("renders ==mark== highlight syntax", async () => {
    await DocumentEditorPage.setContent("高亮段落\n\n==重点内容==");

    await browser.waitUntil(
      async () => {
        return browser.execute(() => Boolean(document.querySelector(".vditor-ir mark")));
      },
      { timeout: 3000, timeoutMsg: "Editor mark highlight was not rendered" },
    );

    const highlighted = await browser.execute(() => document.querySelector(".vditor-ir mark")?.textContent);
    expect(highlighted).toContain("重点内容");

    await DocumentEditorPage.setContent("初始内容");
    await DocumentEditorPage.waitForSaved(3000);
  });

  it("toggles favorite state", async () => {
    await DocumentEditorPage.toggleFavorite();
    const isFav = await DocumentEditorPage.isFavorite();
    expect(isFav).toBe(true);

    const updated = await getItemById(testItem.id);
    expect(updated.favorite).toBe(true);

    await DocumentEditorPage.toggleFavorite();
    const isFav2 = await DocumentEditorPage.isFavorite();
    expect(isFav2).toBe(false);
  });

  it("saves a version", async () => {
    await browser.waitUntil(
      async () => (await DocumentEditorPage.getVersionCount()) > 0,
      { timeout: 5000, timeoutMsg: "Initial version was not loaded" },
    );
    const countBefore = await DocumentEditorPage.getVersionCount();

    await DocumentEditorPage.clearContent();
    await pause(150);
    await DocumentEditorPage.typeContent("manual version change");
    await DocumentEditorPage.waitForSaved(3000);
    await browser.waitUntil(
      async () => DocumentEditorPage.isSaveVersionEnabled(),
      { timeout: 3000, timeoutMsg: "Save version button did not become enabled after content changed" },
    );

    await DocumentEditorPage.clickSaveVersion();

    await browser.waitUntil(
      async () => {
        const count = await DocumentEditorPage.getVersionCount();
        return count > countBefore;
      },
      { timeout: 5000, timeoutMsg: "Version count did not increase" },
    );

    const countAfter = await DocumentEditorPage.getVersionCount();
    expect(countAfter).toBe(countBefore + 1);
    expect(await DocumentEditorPage.isSaveVersionEnabled()).toBe(false);
  });

  it("edits version name and description", async () => {
    // 打开版本面板
    await DocumentEditorPage.openVersionPanel();

    await DocumentEditorPage.clickVersionEdit(0);
    await DocumentEditorPage.editVersionMeta("测试版本名", "测试版本描述");

    const entries = await DocumentEditorPage.getVersionEntries();
    const text = await entries[0].getText();
    expect(text).toContain("测试版本名");
  });

  it("opens version preview modal", async () => {
    await DocumentEditorPage.clickVersionView(0);

    const modal = await $("[data-testid='version-restore-btn']");
    await expect(modal).toBeDisplayed();
    await expect($("[data-testid='version-preview-layout']")).toBeDisplayed();
    await expect($("[data-testid='document-outline']")).toBeDisplayed();
  });

  it("restores version content", async () => {
    const restoreBtn = await $("[data-testid='version-restore-btn']");
    await restoreBtn.click();
    await observePause();
    await restoreBtn.click();
    await pause(500);

    const content = await DocumentEditorPage.getContent();
    expect(content).toContain("manual version change");
  });

  it("adjusts editor width and shares the setting with the reader", async () => {
    await pause(300);

    await DocumentEditorPage.setContentWidth(0);
    const narrowEditorWidth = await DocumentEditorPage.getContentAreaWidth();

    await DocumentEditorPage.setContentWidth(100);
    const fullEditorWidth = await DocumentEditorPage.getContentAreaWidth();
    expect(fullEditorWidth).toBeGreaterThan(narrowEditorWidth);

    await DocumentEditorPage.setContentWidth(10);
    expect(await DocumentEditorPage.getContentWidth()).toBe("10");
    await DocumentEditorPage.setContentWidth(37);
    expect(await DocumentEditorPage.getContentWidth()).toBe("37");
    const savedSettings = await loadAppSettings();
    expect(savedSettings.contentWidthProgress).toBe(18.5);

    await DocumentEditorPage.clickBack();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    await expect($("[data-testid='reader-preview-layout']")).toBeDisplayed();
    await expect($("[data-testid='document-outline']")).toBeDisplayed();
    expect(await LibraryPage.getContentWidth()).toBe("37");
    expect(await LibraryPage.getContentAreaWidth()).toBeGreaterThan(0);

    await browser.setWindowSize(480, 800);
    await pause(300);
    const hasHorizontalOverflow = await browser.execute(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    });
    expect(hasHorizontalOverflow).toBe(false);
    await browser.setWindowSize(1400, 900);

    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => DocumentEditorPage.isDisplayed(),
      { timeout: 5000, timeoutMsg: "Editor did not reopen after reader width check" },
    );
    await DocumentEditorPage.setContentWidth(0);
  });

  it("navigates back to library preview", async () => {
    await DocumentEditorPage.clickBack();

    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
  });
});
