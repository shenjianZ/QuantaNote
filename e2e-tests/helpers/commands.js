/**
 * Tauri 命令桥接模块 — 通过 browser.execute 调用后端命令进行数据预置和清理
 */

export async function waitForTauriBridge(timeout = 10000) {
  await browser.waitUntil(
    async () => {
      return browser.execute(() => {
        return !!(window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.tauri?.invoke);
      });
    },
    { timeout, timeoutMsg: "Tauri bridge not available within timeout" },
  );
}

export async function tauriInvoke(command, args = {}) {
  return browser.execute(async (cmd, a) => {
    // Tauri 2.0 使用 __TAURI_INTERNALS__.invoke
    if (window.__TAURI_INTERNALS__?.invoke) {
      return await window.__TAURI_INTERNALS__.invoke(cmd, a);
    }
    // 降级到 __TAURI__ (Tauri 1.x)
    if (window.__TAURI__?.tauri?.invoke) {
      return await window.__TAURI__.tauri.invoke(cmd, a);
    }
    throw new Error("Tauri bridge not found");
  }, command, args);
}

export async function notifyDataChanged() {
  await browser.execute(() => {
    window.dispatchEvent(new Event("quantanote:e2e-data-changed"));
  });
  await browser.refresh();
  await waitForTauriBridge();
}

// --- Item 操作 ---

export async function seedItem({ title = "测试笔记", content = "测试内容", itemType = "note", pinned = false, favorite = false } = {}) {
  await waitForTauriBridge();
  const item = await tauriInvoke("create_item", { title, itemType, content });
  if (pinned || favorite) {
    await tauriInvoke("update_item", { id: item.id, pinned, favorite });
    await notifyDataChanged();
    return { ...item, pinned, favorite };
  }
  await notifyDataChanged();
  return item;
}

export async function getItemById(id) {
  return tauriInvoke("get_item", { id });
}

export async function getAllItems() {
  return tauriInvoke("get_items", { itemType: null, limit: 200, offset: 0 });
}

export async function deleteItemById(id) {
  const result = await tauriInvoke("delete_item", { id });
  await notifyDataChanged();
  return result;
}

export async function cleanupAllItems() {
  const items = await getAllItems();
  for (const item of items) {
    await deleteItemById(item.id);
  }
}

// --- Tag 操作 ---

export async function seedTag(name, color = "cyan") {
  const tag = await tauriInvoke("create_tag", { name, color });
  await notifyDataChanged();
  return tag;
}

export async function getAllTags() {
  return tauriInvoke("get_all_tags");
}

export async function deleteTagByName(name) {
  const result = await tauriInvoke("delete_tag", { name });
  await notifyDataChanged();
  return result;
}

export async function cleanupAllTags() {
  const tags = await getAllTags();
  for (const tag of tags) {
    await deleteTagByName(tag.name);
  }
}

export async function setItemTags(itemId, tagNames) {
  const result = await tauriInvoke("set_item_tags", { itemId, tagNames });
  await notifyDataChanged();
  return result;
}

// --- Version 操作 ---

export async function seedVersion(itemId, content, name, description = "") {
  const version = await tauriInvoke("create_version", {
    itemId,
    content,
    changeSummary: "E2E 测试",
    name: name || `v-${Date.now()}`,
    description,
  });
  await notifyDataChanged();
  return version;
}

export async function getVersions(itemId) {
  return tauriInvoke("get_versions", { itemId });
}

// --- Attachment 操作 ---

export async function createTestFile(path, content = "test file content") {
  return tauriInvoke("save_to_file", { path, content });
}

export async function seedAttachment(itemId, filePath) {
  const attachment = await tauriInvoke("add_attachment", { itemId, path: filePath });
  await notifyDataChanged();
  return attachment;
}

export async function getAttachments(itemId) {
  return tauriInvoke("get_attachments", { itemId });
}

export async function deleteAttachmentById(id) {
  const result = await tauriInvoke("delete_attachment", { id });
  await notifyDataChanged();
  return result;
}

// --- Import/Export ---

export async function exportAllData() {
  return tauriInvoke("export_data");
}

export async function importData(jsonString) {
  const result = await tauriInvoke("import_data", { json: jsonString });
  await notifyDataChanged();
  return result;
}

// --- Settings ---

export async function getDbSize() {
  return tauriInvoke("get_db_size");
}

export async function optimizeDb() {
  return tauriInvoke("optimize_db");
}

// --- 状态重置 ---

export async function resetAppState() {
  await browser.execute(() => {
    localStorage.removeItem("quantanote-theme");
    localStorage.removeItem("quantanote-settings");
    localStorage.removeItem("quantanote-current-page");
  });
}

export async function setTheme(theme) {
  await browser.execute((t) => {
    localStorage.setItem("quantanote-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }, theme);
}

// --- 批量清理 ---

export async function cleanupAll() {
  await waitForTauriBridge();
  await cleanupAllItems();
  await cleanupAllTags();
  await notifyDataChanged();
}
