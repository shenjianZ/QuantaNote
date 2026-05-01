describe("QuantaNote desktop smoke", () => {
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
    await $("button[aria-haspopup='menu']").click();
    await $("//button[contains(., '设置')]").click();
    await expect($("//button[contains(., '深色')]")).toBeDisplayed();

    await $("//button[contains(., '深色')]").click();
    const theme = await browser.execute(() => document.documentElement.getAttribute("data-theme"));
    expect(theme).toBe("dark");
  });
});
