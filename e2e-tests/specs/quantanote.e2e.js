describe("QuantaNote desktop smoke", () => {
  async function closeOverlays() {
    await browser.keys("Escape");
    await browser.keys("Escape");
    await browser.pause(100);
  }

  async function goLibrary() {
    await closeOverlays();
    await $("//header//button[contains(., '记录库')]").click();
    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();
  }

  async function openSettings() {
    await closeOverlays();
    const menuButton = await $("button[aria-haspopup='menu']");
    if ((await menuButton.getAttribute("aria-expanded")) !== "true") {
      await menuButton.click();
    }
    await $("//div[@role='menu']//button[contains(., '设置')]").click();
    const darkButton = await $("//button[contains(., '深色')]");
    if (!(await darkButton.isDisplayed().catch(() => false))) {
      await $("//nav//button[contains(., '外观')]").click();
    }
    await expect($("//button[contains(., '深色')]")).toBeDisplayed();
  }

  async function createNoteFromLibrary(title) {
    await goLibrary();
    await $("//button[contains(., '新建')]").click();
    const titleInput = await $("input[placeholder='文档标题']");
    await expect(titleInput).toBeDisplayed();
    await titleInput.setValue(title);
    await browser.pause(1300);
    await goLibrary();
    await expect($(`//*[contains(., '${title}')]`)).toBeDisplayed();
  }

  afterEach(async () => {
    await closeOverlays();
  });

  it("opens the real desktop app on the workspace page", async () => {
    await expect($("//h1[contains(., '随手记录')]")).toBeDisplayed();
    await expect($("//button[contains(., '记录')]")).toBeDisplayed();
  });

  it("opens and closes the command palette with the keyboard", async () => {
    await browser.keys(["Control", "k"]);
    await expect($("input[placeholder='搜索笔记']")).toBeDisplayed();

    await browser.keys("Escape");
    await expect($("input[placeholder='搜索笔记']")).not.toBeDisplayed();
  });

  it("creates a note from the library action and shows the editor", async () => {
    await $("//button[contains(., '记录库')]").click();
    await expect($("//h1[contains(., '记录库')]")).toBeDisplayed();

    await $("//button[contains(., '新建')]").click();
    await expect($("input[placeholder='文档标题']")).toBeDisplayed();
    await expect($("//summary[contains(., '版本记录')]")).toBeDisplayed();
  });

  it("switches to settings and changes theme", async () => {
    await openSettings();

    await $("//button[contains(., '深色')]").click();
    const theme = await browser.execute(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("dark");
  });

  it("creates a note and verifies it appears in library", async () => {
    await createNoteFromLibrary("E2E 测试笔记");
  });

  it("searches for note in command palette", async () => {
    const title = "E2E 搜索笔记";
    await createNoteFromLibrary(title);

    await browser.keys(["Control", "k"]);
    const input = await $("input[placeholder='搜索笔记']");
    await input.setValue("E2E");

    await expect($(`//section[.//input[@placeholder='搜索笔记']]//*[contains(., '${title}')]`)).toBeDisplayed();

    await browser.keys("Escape");
    await expect($("input[placeholder='搜索笔记']")).not.toBeDisplayed();
  });

  it("opens settings and verifies all sections", async () => {
    await openSettings();
    await expect($("//h2[contains(., '外观主题')]")).toBeDisplayed();

    await $("//button[contains(., '字体')]").click();
    await expect($("//span[contains(., '界面字体')]")).toBeDisplayed();

    await $("//button[contains(., '数据')]").click();
    await expect($("//button[contains(., '立即备份')]")).toBeDisplayed();

    await $("//button[contains(., '关于')]").click();
    await expect($("//*[contains(., 'QuantaNote')]")).toBeDisplayed();
  });

  it("toggles theme and verifies persistence", async () => {
    await openSettings();

    await $("//button[contains(., '浅色')]").click();
    let theme = await browser.execute(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("light");

    await $("//button[contains(., '深色')]").click();
    theme = await browser.execute(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("dark");
  });
});
