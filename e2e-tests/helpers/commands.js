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

export async function permanentlyDeleteItemById(id) {
  return tauriInvoke("permanently_delete_item", { id });
}

export async function cleanupAllItems() {
  const items = await getAllItems();
  for (const item of items) {
    await permanentlyDeleteItemById(item.id);
  }
  const trashItems = await tauriInvoke("get_trash_items");
  for (const trashItem of trashItems) {
    await permanentlyDeleteItemById(trashItem.item.id);
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
  const dbPath = await tauriInvoke("get_db_path");
  const separator = dbPath.includes("\\") ? "\\" : "/";
  const dataDir = dbPath.replace(/[\\/][^\\/]+$/, "");
  const safeName = path.split(/[\\/]/).pop();
  const fullPath = `${dataDir}${separator}${safeName}`;
  await tauriInvoke("save_to_file", { path: fullPath, content });
  return fullPath;
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

const DEFAULT_APP_SETTINGS = {
  fontFamily: "Noto Sans SC",
  fontMono: "JetBrains Mono",
  fontSize: 15,
  contentWidthProgress: 0,
  showDocumentOutline: true,
  accentColor: "#386c5f",
  customAccentColors: [],
  minimizeToTray: true,
  closeKeepRunning: false,
  autoBackup: true,
  autostart: false,
  sqlLogging: {
    enabled: false,
    toConsole: false,
    toFile: true,
    pretty: false,
    maxLen: 4000,
  },
  locale: "zh-CN",
};

export async function loadSettingsMap() {
  await waitForTauriBridge();
  return tauriInvoke("load_all_settings");
}

export async function saveSettingsMap(settings) {
  await waitForTauriBridge();
  return tauriInvoke("save_settings", { settings });
}

export async function loadAppSettings() {
  const settings = await loadSettingsMap();
  return settings["quantanote-settings"]
    ? JSON.parse(settings["quantanote-settings"])
    : {};
}

export async function waitForSetting(key, expectedValue, timeout = 5000) {
  await browser.waitUntil(
    async () => {
      const settings = await loadSettingsMap();
      return settings[key] === expectedValue;
    },
    { timeout, timeoutMsg: `Expected setting ${key}=${expectedValue}` },
  );
}

export async function waitForAppSetting(key, predicate, timeout = 5000) {
  await browser.waitUntil(
    async () => {
      const settings = await loadAppSettings();
      return predicate(settings[key], settings);
    },
    { timeout, timeoutMsg: `Expected app setting ${key}` },
  );
}

// --- 状态重置 ---

export async function resetAppState() {
  await waitForTauriBridge();
  await saveSettingsMap({
    theme: "system",
    currentPage: "workspace",
    alwaysOnTop: "false",
    "quantanote-settings": JSON.stringify(DEFAULT_APP_SETTINGS),
  });
  await browser.execute(() => {
    localStorage.removeItem("quantanote-theme");
    localStorage.removeItem("quantanote-settings");
    localStorage.removeItem("quantanote-current-page");
    document.documentElement.setAttribute("data-theme", "system");
  });
  await browser.refresh();
  await waitForTauriBridge();
}

export async function setTheme(theme) {
  await saveSettingsMap({ theme });
  await browser.execute((t) => {
    document.documentElement.setAttribute("data-theme", t);
  }, theme);
}

// --- 批量清理 ---

export async function cleanupAll() {
  await waitForTauriBridge();
  await browser.waitUntil(
    async () => browser.execute(() => {
      const bodyText = document.body.innerText;
      return bodyText.includes("Welcome") || Boolean(document.querySelector("[data-testid='nav-library']"));
    }),
    { timeout: 10000, timeoutMsg: "App shell did not finish initializing within 10000ms" },
  );
  // 每个串行 spec 使用全新的临时数据目录，跳过首次启动的语言选择页，确保导航元素可用。
  const e2eSettings = JSON.stringify({ ...DEFAULT_APP_SETTINGS, locale: "zh-CN" });
  await browser.waitUntil(
    async () => {
      await saveSettingsMap({
        "has-selected-language": "true",
        "quantanote-settings": e2eSettings,
      });
      const saved = await loadSettingsMap();
      if (saved["has-selected-language"] !== "true") return false;
      try {
        return JSON.parse(saved["quantanote-settings"] || "{}").locale === "zh-CN";
      } catch {
        return false;
      }
    },
    { timeout: 5000, timeoutMsg: "E2E language settings were not persisted" },
  );
  await cleanupAllItems();
  await cleanupAllTags();
  await notifyDataChanged();
}

// --- Sync 配置 ---

export async function getSyncConfig() {
  return tauriInvoke("get_sync_config");
}

export async function getSyncQueueStatus() {
  return tauriInvoke("get_sync_queue_status");
}

export async function saveSyncConfig(config) {
  return tauriInvoke("save_sync_config_cmd", { config });
}

export async function pauseSync() {
  return tauriInvoke("pause_sync");
}

export async function resumeSync() {
  return tauriInvoke("resume_sync");
}

// --- 备份 ---

export async function getAutoBackupConfig() {
  return tauriInvoke("get_auto_backup_config");
}

export async function updateAutoBackupConfig(config) {
  return tauriInvoke("update_auto_backup_config", { config });
}

export async function triggerBackupNow() {
  return tauriInvoke("trigger_backup_now");
}

export async function listBackups() {
  return tauriInvoke("list_backups");
}

export async function deleteBackup(filename) {
  return tauriInvoke("delete_backup", { filename });
}

export async function verifyBackup(filename) {
  return tauriInvoke("verify_backup", { filename });
}

// --- SQL 诊断 ---

export async function getSqlLogConfig() {
  return tauriInvoke("get_sql_log_config");
}

export async function updateSqlLogConfig(config) {
  return tauriInvoke("update_sql_log_config", { config });
}

export async function clearSqlLog() {
  return tauriInvoke("clear_sql_log");
}

// --- 版本 ---

export async function deleteVersion(versionId) {
  return tauriInvoke("delete_version", { versionId });
}

// --- 导出/导入扩展 ---

export async function getExportSizeEstimate() {
  return tauriInvoke("get_export_size_estimate");
}
