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
  let testAttachment;

  before(async () => {
    await completeInitialLanguageSetup();
    await cleanupAll();
    testItem = await seedItem({ title: "编辑器测试笔记", content: "初始内容" });
    const imagePath = await createTestFile(
      "quantanote-editor-reentry.svg",
      "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"1800\" viewBox=\"0 0 1200 1800\"><rect width=\"1200\" height=\"1800\" fill=\"#2563eb\"/><circle cx=\"600\" cy=\"900\" r=\"280\" fill=\"#93c5fd\"/></svg>",
    );
    testAttachment = await tauriInvoke("add_attachment", { itemId: testItem.id, path: imagePath });
    await tauriInvoke("update_item", {
      id: testItem.id,
      content: `![quantanote-editor-reentry.svg](attachment://${encodeURIComponent(testAttachment.id)})`,
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

  it("shows the explicitly triggered AI summary control", async () => {
    expect(await DocumentEditorPage.hasAiSummaryButton()).toBe(true);
  });

  it("shows the explicitly triggered AI tag suggestion control", async () => {
    expect(await DocumentEditorPage.hasAiTagsButton()).toBe(true);
  });

  it("shows the explicitly triggered AI knowledge control", async () => {
    expect(await DocumentEditorPage.hasAiKnowledgeButton()).toBe(true);
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

    await browser.waitUntil(
      async () => browser.execute(() => {
        const editor = document.querySelector(".vditor-ir .vditor-reset");
        return Boolean(editor && editor.scrollHeight > editor.clientHeight);
      }),
      { timeout: 5000, timeoutMsg: "Reopened image document did not become scrollable" },
    );
    const before = await browser.execute(() => {
      const main = document.querySelector("[data-testid='document-editor-main']");
      const article = document.querySelector("[data-testid='document-editor-article']");
      if (!main || !article) throw new Error("Editor layout nodes not found");
      return {
        mainHeight: main.getBoundingClientRect().height,
        articleHeight: article.getBoundingClientRect().height,
      };
    });
    const editor = await $(".vditor-ir .vditor-reset");
    await editor.scrollIntoView();
    await browser.action("wheel").scroll({
      origin: editor,
      deltaX: 0,
      deltaY: 900,
      duration: 100,
    }).perform();
    await pause(200);
    const after = await browser.execute(() => {
      const main = document.querySelector("[data-testid='document-editor-main']");
      const article = document.querySelector("[data-testid='document-editor-article']");
      const editorNode = document.querySelector(".vditor-ir .vditor-reset");
      if (!main || !article || !editorNode) throw new Error("Editor layout nodes not found");
      return {
        mainHeight: main.getBoundingClientRect().height,
        articleHeight: article.getBoundingClientRect().height,
        scrollTop: editorNode.scrollTop,
      };
    });
    expect(after.scrollTop).toBeGreaterThan(0);
    expect(Math.abs(after.mainHeight - before.mainHeight)).toBeLessThan(4);
    expect(Math.abs(after.articleHeight - after.mainHeight)).toBeLessThan(4);
  });

  it("keeps the editor card stable while mouse-wheel scrolling an image document", async () => {
    const imageReference = `attachment://${encodeURIComponent(testAttachment.id)}`;
    const imageDocument = [
      "# 图片滚动布局检查",
      ...Array.from({ length: 10 }, (_, index) => `![quantanote-editor-reentry.svg](${imageReference})\n\n图片节点 ${index + 1}`),
    ].join("\n\n");
    await DocumentEditorPage.setContent(imageDocument);
    await browser.waitUntil(
      async () => browser.execute(() => {
        const editor = document.querySelector(".vditor-ir .vditor-reset");
        const images = document.querySelectorAll(".vditor-ir img:not(.emoji)");
        return Boolean(editor && images.length === 10 && editor.scrollHeight > editor.clientHeight);
      }),
      { timeout: 8000, timeoutMsg: "Image document did not become scrollable" },
    );

    const getGeometry = () => browser.execute(() => {
      const main = document.querySelector("[data-testid='document-editor-main']");
      const article = document.querySelector("[data-testid='document-editor-article']");
      if (!main || !article) throw new Error("Editor layout nodes not found");
      return {
        mainHeight: main.getBoundingClientRect().height,
        articleHeight: article.getBoundingClientRect().height,
      };
    });
    const before = await getGeometry();
    const editor = await $(".vditor-ir .vditor-reset");
    await editor.scrollIntoView();
    await browser.action("wheel").scroll({
      origin: editor,
      deltaX: 0,
      deltaY: 900,
      duration: 100,
    }).perform();
    await pause(200);
    const after = await getGeometry();
    const scrollTop = await browser.execute(() => document.querySelector(".vditor-ir .vditor-reset")?.scrollTop ?? 0);

    expect(scrollTop).toBeGreaterThan(0);
    expect(Math.abs(after.mainHeight - before.mainHeight)).toBeLessThan(4);
    expect(Math.abs(after.articleHeight - after.mainHeight)).toBeLessThan(4);
  });

  it("does not shift text when a newly opened image finishes loading", async () => {
    const delayedImageDocument = [
      "# 图片加载位移检查",
      `![quantanote-editor-reentry.svg](attachment://${encodeURIComponent(testAttachment.id)})`,
      "图片加载完成后，这行文字的位置不应改变。",
    ].join("\n\n");
    await tauriInvoke("update_item", { id: testItem.id, content: delayedImageDocument });
    await notifyDataChanged();
    await TopBar.navLibrary();
    const libraryItem = await $("[data-testid='library-item']");
    await libraryItem.waitForDisplayed({ timeout: 10000 });
    await libraryItem.click();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();

    await LibraryPage.clickEdit();
    await browser.execute(() => {
      window.__quantanoteLayoutShifts = [];
      if (typeof PerformanceObserver === "undefined") return;
      const observer = new PerformanceObserver((list) => {
        window.__quantanoteLayoutShifts.push(...list.getEntries().map((entry) => ({
          value: entry.value,
          hadRecentInput: entry.hadRecentInput,
        })));
      });
      try {
        observer.observe({ type: "layout-shift", buffered: false });
        window.__quantanoteLayoutShiftObserver = observer;
      } catch {
        // WebView2 版本不支持 layout-shift 时,下面的元素几何检查仍会执行。
      }
    });
    await browser.waitUntil(
      async () => browser.execute(() => {
        const image = document.querySelector(".vditor-ir img[alt='quantanote-editor-reentry.svg']");
        const text = Array.from(document.querySelectorAll(".vditor-ir *")).find((node) => node.textContent?.includes("这行文字的位置"));
        return Boolean(image?.complete && image.naturalWidth > 0 && text);
      }),
      { timeout: 8000, timeoutMsg: "Layout-shift verification image did not finish loading" },
    );
    await pause(300);
    const layoutShift = await browser.execute(() => {
      window.__quantanoteLayoutShiftObserver?.disconnect();
      const entries = window.__quantanoteLayoutShifts || [];
      return {
        supported: Boolean(window.__quantanoteLayoutShiftObserver),
        value: entries.filter((entry) => !entry.hadRecentInput).reduce((total, entry) => total + entry.value, 0),
      };
    });
    if (layoutShift.supported) expect(layoutShift.value).toBeLessThan(0.001);

    await DocumentEditorPage.setContent(`![quantanote-editor-reentry.svg](attachment://${encodeURIComponent(testAttachment.id)})`);
    await DocumentEditorPage.waitForSaved(3000);
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

    await expect($("[data-testid='image-editor-alt']")).not.toBeExisting();
    await $("[data-testid='image-editor-details-toggle']").click();
    const altInput = await $("[data-testid='image-editor-alt']");
    await altInput.clearValue();
    await altInput.setValue("正文截图");
    const widthInput = await $("[data-testid='image-editor-width']");
    await widthInput.clearValue();
    await widthInput.setValue("640");
    await $("button[aria-label='右对齐']").click();
    await $("[data-testid='image-editor-apply']").click();

    let latestImageContent = "";
    await browser.waitUntil(
      async () => {
        const updated = await getItemById(testItem.id);
        latestImageContent = updated.content;
        return updated.content.includes("正文截图")
          && updated.content.includes("qn-width=640")
          && updated.content.includes("qn-align=right");
      },
      { timeout: 5000, timeoutMsg: `Image metadata was not persisted: ${latestImageContent}` },
    );
    const updated = await getItemById(testItem.id);
    expect(updated.content).not.toContain(".quantanote");
    expect(updated.content).not.toMatch(/[A-Za-z]:[\\/].*attachments[\\/]/);

    await DocumentEditorPage.clickBack();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    const readerImageLayout = await browser.execute(() => {
      const preview = document.querySelector("[data-testid='reader-drawer'] .markdown-preview");
      const frame = preview?.querySelector(".markdown-image-frame");
      if (!preview || !frame) throw new Error("Reader image frame was not found");
      const previewRect = preview.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const previewStyle = window.getComputedStyle(preview);
      const contentRight = previewRect.right - Number.parseFloat(previewStyle.paddingRight || "0");
      return {
        className: frame.className,
        frameRight: frameRect.right,
        contentRight,
      };
    });
    expect(readerImageLayout.className).toContain("markdown-image-frame--right");
    expect(readerImageLayout.frameRight).toBeGreaterThanOrEqual(readerImageLayout.contentRight - 8);
    const readerImage = await $("[data-testid='reader-drawer'] .markdown-image-frame img[alt='正文截图']");
    await readerImage.click();
    await expect($("[data-testid='reader-image-preview-modal']")).toBeDisplayed();
    await browser.waitUntil(
      async () => browser.execute(() => {
        const preview = document.querySelector("[data-testid='reader-image-preview-content']");
        return preview instanceof HTMLImageElement && preview.complete && preview.naturalWidth > 0;
      }),
      { timeout: 3000, timeoutMsg: "Reader image preview did not render" },
    );
    await $("[data-testid='reader-image-preview-close']").click();
    await expect($("[data-testid='reader-image-preview-modal']")).not.toBeDisplayed();
    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => browser.execute(() => {
        const imageNode = document.querySelector(".vditor-ir img[alt='正文截图']");
        return imageNode?.style.width === "640px";
      }),
      { timeout: 5000, timeoutMsg: "Image presentation was not restored after reopening" },
    );
  });

  it("previews and copies an image from the compact image editor", async () => {
    const image = await $(".vditor-ir img:not(.emoji)");
    await image.click();
    await browser.waitUntil(
      async () => (await $("[data-testid='image-editor-popover']")).isDisplayed(),
      { timeout: 3000, timeoutMsg: "Image editor popover did not open for preview test" },
    );

    await $("[data-testid='image-preview']").click();
    await expect($("[data-testid='image-preview-modal']")).toBeDisplayed();
    await browser.waitUntil(
      async () => browser.execute(() => {
        const preview = document.querySelector("[data-testid='image-preview-content']");
        return preview instanceof HTMLImageElement && preview.complete && preview.naturalWidth > 0;
      }),
      { timeout: 3000, timeoutMsg: "Full-screen image preview did not render" },
    );
    await expect($("[data-testid='image-preview-scale']")).toHaveText("100%");
    const scaleBeforeWheel = await browser.execute(() => {
      const preview = document.querySelector("[data-testid='image-preview-content']");
      return preview instanceof HTMLImageElement ? preview.style.transform : "";
    });
    await browser.execute(() => {
      const stage = document.querySelector("[data-testid='image-preview-stage']");
      stage?.dispatchEvent(new WheelEvent("wheel", { deltaY: -120, bubbles: true, cancelable: true }));
    });
    await browser.waitUntil(
      async () => browser.execute((before) => {
        const preview = document.querySelector("[data-testid='image-preview-content']");
        return preview instanceof HTMLImageElement && preview.style.transform !== before;
      }, scaleBeforeWheel),
      { timeout: 3000, timeoutMsg: "Image preview did not zoom with the mouse wheel" },
    );
    const scaleAfterWheel = await browser.execute(() => {
      const preview = document.querySelector("[data-testid='image-preview-content']");
      return preview instanceof HTMLImageElement ? preview.style.transform : "";
    });
    expect(scaleAfterWheel).toContain("scale(1.1)");
    await expect($("[data-testid='image-preview-scale']")).toHaveText("110%");
    await browser.execute(() => {
      const stage = document.querySelector("[data-testid='image-preview-stage']");
      stage?.dispatchEvent(new MouseEvent("mousedown", {
        button: 0,
        clientX: 100,
        clientY: 100,
        bubbles: true,
      }));
    });
    await browser.pause(50);
    await browser.execute(() => {
      window.dispatchEvent(new MouseEvent("mousemove", {
        clientX: 140,
        clientY: 125,
        bubbles: true,
      }));
      window.dispatchEvent(new MouseEvent("mouseup", {
        button: 0,
        clientX: 140,
        clientY: 125,
        bubbles: true,
      }));
    });
    await browser.pause(100);
    const transformAfterDrag = await browser.execute(() => {
      const preview = document.querySelector("[data-testid='image-preview-content']");
      return preview instanceof HTMLImageElement ? preview.style.transform : "";
    });
    expect(transformAfterDrag).toContain("translate3d(40px, 25px");
    await $("[data-testid='image-preview-close']").click();
    await expect($("[data-testid='image-preview-modal']")).not.toBeDisplayed();

    await $("[data-testid='image-editor-copy']").click();
    await browser.waitUntil(
      async () => (await $("[data-testid='toast-success']")).isDisplayed(),
      { timeout: 3000, timeoutMsg: "Image copy did not report success" },
    );
    await $("[data-testid='image-editor-close']").click();
  });

  it("keeps the image editor popover visible and attached while scrolling", async () => {
    const imageSource = `attachment://${encodeURIComponent(testAttachment.id)}`;
    const floatingImageDocument = [
      "# 图片属性浮层定位检查",
      ...Array.from({ length: 6 }, (_, index) => `浮层定位前的正文 ${index + 1}`),
      `![quantanote-editor-reentry.svg](${imageSource})`,
      ...Array.from({ length: 20 }, (_, index) => `浮层定位后的正文 ${index + 1}`),
    ].join("\n\n");
    await tauriInvoke("update_item", { id: testItem.id, content: floatingImageDocument });
    await notifyDataChanged();
    await TopBar.navLibrary();
    const libraryItem = await $("[data-testid='library-item']");
    await libraryItem.waitForDisplayed({ timeout: 10000 });
    await libraryItem.click();
    await expect($("[data-testid='reader-drawer']")).toBeDisplayed();
    await LibraryPage.clickEdit();
    await browser.waitUntil(
      async () => browser.execute(() => {
        const image = document.querySelector(".vditor-ir img[alt='quantanote-editor-reentry.svg']");
        const editor = document.querySelector(".vditor-ir .vditor-reset");
        return Boolean(image?.complete && image.naturalWidth > 0 && editor && editor.scrollHeight > editor.clientHeight);
      }),
      { timeout: 5000, timeoutMsg: "Floating UI test image did not render" },
    );

    await browser.execute(() => {
      const image = document.querySelector(".vditor-ir img[alt='quantanote-editor-reentry.svg']");
      if (!(image instanceof HTMLImageElement)) throw new Error("Floating UI test image was not found");
      image.scrollIntoView({ block: "end", inline: "nearest" });
      image.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await browser.waitUntil(
      async () => $("[data-testid='image-editor-popover']").isDisplayed(),
      { timeout: 3000, timeoutMsg: "Image editor popover did not open for positioning test" },
    );

    const getPopoverLayout = () => browser.execute(() => {
      const image = document.querySelector(".vditor-ir img[alt='quantanote-editor-reentry.svg']");
      const popover = document.querySelector("[data-testid='image-editor-popover']");
      const editor = document.querySelector(".vditor-ir .vditor-reset");
      if (!image || !popover || !editor) throw new Error("Floating UI layout nodes were not found");
      const imageRect = image.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      return {
        imageBottom: imageRect.bottom,
        popoverTop: popoverRect.top,
        popoverRight: popoverRect.right,
        popoverBottom: popoverRect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollTop: editor.scrollTop,
      };
    });
    const before = await getPopoverLayout();
    expect(before.popoverTop).toBeGreaterThanOrEqual(0);
    expect(before.popoverRight).toBeLessThanOrEqual(before.viewportWidth + 1);
    expect(before.popoverBottom).toBeLessThanOrEqual(before.viewportHeight + 1);

    await browser.execute(() => {
      const editor = document.querySelector(".vditor-ir .vditor-reset");
      if (!editor) throw new Error("Editor scroll container was not found");
      const maxScrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
      const nextScrollTop = Math.min(maxScrollTop, editor.scrollTop + 180);
      if (nextScrollTop <= editor.scrollTop) {
        throw new Error(`Editor did not have enough scrollable content: ${editor.scrollTop}/${maxScrollTop}`);
      }
      editor.scrollTop = nextScrollTop;
      editor.dispatchEvent(new Event("scroll", { bubbles: false }));
    });
    await pause(200);
    const after = await getPopoverLayout();
    expect(after.scrollTop).toBeGreaterThan(before.scrollTop);
    expect(after.popoverTop).toBeGreaterThanOrEqual(0);
    expect(after.popoverRight).toBeLessThanOrEqual(after.viewportWidth + 1);
    expect(after.popoverBottom).toBeLessThanOrEqual(after.viewportHeight + 1);
    expect(Math.abs(
      (after.popoverTop - after.imageBottom) - (before.popoverTop - before.imageBottom),
    )).toBeLessThan(4);

    await $("[data-testid='image-editor-close']").click();
    await DocumentEditorPage.setContent(`![quantanote-editor-reentry.svg](attachment://${encodeURIComponent(testAttachment.id)})`);
    await DocumentEditorPage.waitForSaved(3000);
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

  it("keeps the editor card viewport-sized after scrolling long content", async () => {
    const longContent = Array.from({ length: 80 }, (_, index) => `## 滚动布局检查 ${index + 1}\n\n这是用于验证编辑器高度约束的正文。`).join("\n\n");
    await DocumentEditorPage.setContent(longContent);
    await browser.waitUntil(
      async () => browser.execute(() => {
        const editor = document.querySelector(".vditor-ir .vditor-reset");
        return Boolean(editor && editor.scrollHeight > editor.clientHeight);
      }),
      { timeout: 5000, timeoutMsg: "Long editor content did not become scrollable" },
    );

    const getGeometry = () => browser.execute(() => {
      const content = document.querySelector("[data-testid='document-editor-content']");
      const toolbar = document.querySelector("[data-testid='document-editor-toolbar']");
      const main = document.querySelector("[data-testid='document-editor-main']");
      const article = document.querySelector("[data-testid='document-editor-article']");
      const status = document.querySelector("[data-testid='document-editor-status']");
      if (!content || !toolbar || !main || !article || !status) throw new Error("Editor layout nodes not found");
      const toolbarRect = toolbar.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const articleRect = article.getBoundingClientRect();
      const statusRect = status.getBoundingClientRect();
      const contentStyle = getComputedStyle(content);
      const statusStyle = getComputedStyle(status);
      const contentInnerHeight = content.clientHeight
        - parseFloat(contentStyle.paddingTop)
        - parseFloat(contentStyle.paddingBottom);
      return {
        expectedMainHeight: contentInnerHeight
          - toolbarRect.height
          - parseFloat(getComputedStyle(toolbar).marginBottom)
          - statusRect.height
          - parseFloat(statusStyle.marginTop),
        mainHeight: mainRect.height,
        articleHeight: articleRect.height,
      };
    });

    const before = await getGeometry();
    const editor = await $(".vditor-ir .vditor-reset");
    await editor.scrollIntoView();
    await browser.action("wheel").scroll({
      origin: editor,
      deltaX: 0,
      deltaY: 700,
      duration: 100,
    }).perform();
    await pause(200);
    const after = await getGeometry();
    const scrollTop = await browser.execute(() => document.querySelector(".vditor-ir .vditor-reset")?.scrollTop ?? 0);

    expect(scrollTop).toBeGreaterThan(0);
    expect(after.mainHeight).toBeGreaterThan(after.expectedMainHeight - 4);
    expect(Math.abs(after.articleHeight - after.mainHeight)).toBeLessThan(4);
    expect(Math.abs(after.mainHeight - before.mainHeight)).toBeLessThan(4);
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
