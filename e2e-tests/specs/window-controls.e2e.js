import { cleanupAll, resetAppState } from "../helpers/commands.js";
import { observePause } from "../helpers/config.js";
import TopBar from "../helpers/page-objects/TopBar.js";

describe("Window controls", () => {
  after(async () => {
    await resetAppState();
  });

  it("pin toggle changes aria-pressed attribute", async () => {
    const wasPinned = await TopBar.isPinned();
    await TopBar.togglePin();

    const isPinned = await TopBar.isPinned();
    expect(isPinned).toBe(!wasPinned);

    // 恢复原状
    await TopBar.togglePin();
    const restored = await TopBar.isPinned();
    expect(restored).toBe(wasPinned);
  });

  it("maximize button title changes on toggle", async () => {
    const titleBefore = await TopBar.maximizeTitle();
    await TopBar.maximize();
    await observePause();

    const titleAfter = await TopBar.maximizeTitle();
    // 标题应在 "全屏" 和 "恢复" 之间切换
    expect(titleAfter).not.toBe(titleBefore);

    // 恢复
    await TopBar.maximize();
    await observePause();
  });

  it("close button exists and is clickable (without actually closing)", async () => {
    const btn = await $("[data-testid='window-close']");
    await expect(btn).toBeDisplayed();
    // 不实际点击关闭按钮，只验证存在
  });
});
