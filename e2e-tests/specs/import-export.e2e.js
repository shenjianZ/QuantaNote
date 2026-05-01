import { cleanupAll, seedItem, seedTag, setItemTags, seedVersion, exportAllData, importData, getAllItems, getAllTags, getVersions } from "../helpers/commands.js";

describe("Import and export", () => {
  before(async () => {
    await cleanupAll();
  });

  after(async () => {
    await cleanupAll();
  });

  it("exports data as JSON via Tauri command", async () => {
    await seedItem({ title: "导出测试笔记", content: "导出内容" });
    const json = await exportAllData();

    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);

    const data = JSON.parse(json);
    expect(data.items).toBeDefined();
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.some((i) => i.title === "导出测试笔记")).toBe(true);
  });

  it("exports data then imports into clean state", async () => {
    const json = await exportAllData();
    await cleanupAll();

    // 确认清理干净
    const itemsBefore = await getAllItems();
    expect(itemsBefore.length).toBe(0);

    // 导入
    await importData(json);

    const itemsAfter = await getAllItems();
    expect(itemsAfter.some((i) => i.title === "导出测试笔记")).toBe(true);
  });

  it("import preserves tags", async () => {
    await seedTag("导出标签", "purple");
    const item = await seedItem({ title: "带标签的笔记", content: "内容" });
    await setItemTags(item.id, ["导出标签"]);

    const json = await exportAllData();
    await cleanupAll();

    await importData(json);

    const tags = await getAllTags();
    expect(tags.some((t) => t.name === "导出标签")).toBe(true);
  });

  it("import preserves versions", async () => {
    const item = await seedItem({ title: "带版本的笔记", content: "版本内容" });
    await seedVersion(item.id, "版本1内容", "v1");

    const json = await exportAllData();
    await cleanupAll();

    await importData(json);

    const items = await getAllItems();
    const imported = items.find((i) => i.title === "带版本的笔记");
    expect(imported).toBeDefined();

    const versions = await getVersions(imported.id);
    expect(versions.length).toBeGreaterThanOrEqual(1);
  });
});
