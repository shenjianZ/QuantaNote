import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useItemStore } from "./itemStore";
import { normalizeSettings, useSettingsStore } from "./settingsStore";
import { DEFAULT_SHORTCUTS } from "../utils/shortcutRegistry";

const saveMock = vi.fn();
const openMock = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => saveMock(...args),
  open: (...args: unknown[]) => openMock(...args),
}));

describe("settingsStore", () => {
  beforeEach(() => {
    saveMock.mockReset();
    openMock.mockReset();
    mockIPC(() => null);
    useSettingsStore.setState({
      settings: {
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
        autoUpdateEnabled: false,
        floatingBall: false,
        floatingBallPosition: null,
        sqlLogging: {
          enabled: false,
          toConsole: false,
          toFile: true,
          pretty: false,
          maxLen: 4000,
        },
        shortcuts: { ...DEFAULT_SHORTCUTS },
        locale: "zh-CN",
      },
      dbSize: "计算中...",
    });
    useItemStore.setState({
      items: [],
      selectedItem: null,
      pinnedItems: [],
      recentItems: [],
      loading: false,
      error: null,
    });
  });

  it("persists and applies visual settings", () => {
    useSettingsStore.getState().updateSetting("accentColor", "#2563eb");

    expect(useSettingsStore.getState().settings.accentColor).toBe("#2563eb");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#2563eb");
  });

  it("applies interface font size scale from settings", () => {
    useSettingsStore.getState().updateSetting("fontSize", 16);

    const rootStyle = document.documentElement.style;
    expect(rootStyle.getPropertyValue("--font-size-base")).toBe("16px");
    expect(rootStyle.getPropertyValue("--font-size-md")).toBe("16px");
    expect(rootStyle.getPropertyValue("--font-size-sm")).toBe("16px");
    expect(rootStyle.getPropertyValue("--font-size-xs")).toBe("max(12px, calc(16px - 2px))");
    expect(rootStyle.getPropertyValue("--font-size-2xl")).toBe("calc(16px + 9px)");
    expect(rootStyle.getPropertyValue("--font-size-md-h1")).toBe("calc(16px + 13px)");
  });

  it("normalizes content width progress when updating settings", () => {
    useSettingsStore.getState().updateSetting("contentWidthProgress", 150);
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(50);

    useSettingsStore.getState().updateSetting("contentWidthProgress", -20);
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(0);
  });

  it("fills a missing content width setting with the default", () => {
    const normalized = normalizeSettings({
      ...useSettingsStore.getState().settings,
      contentWidthProgress: undefined as unknown as number,
    });

    expect(normalized.contentWidthProgress).toBe(0);
  });

  it("defaults the document outline to visible and preserves an explicit boolean", () => {
    const settings = useSettingsStore.getState().settings;
    const missing = normalizeSettings({ ...settings, showDocumentOutline: undefined as unknown as boolean });
    const hidden = normalizeSettings({ ...settings, showDocumentOutline: false });
    const invalid = normalizeSettings({ ...settings, showDocumentOutline: "false" as unknown as boolean });

    expect(missing.showDocumentOutline).toBe(true);
    expect(hidden.showDocumentOutline).toBe(false);
    expect(invalid.showDocumentOutline).toBe(true);
  });

  it("exports data through dialog and save_to_file command", async () => {
    const calls: Array<{ cmd: string; args: unknown }> = [];
    saveMock.mockResolvedValue("D:\\backup.json");
    mockIPC((cmd, args) => {
      calls.push({ cmd, args });
      if (cmd === "export_data") return "{\"items\":[]}";
      return null;
    });

    await useSettingsStore.getState().exportData();

    expect(saveMock).toHaveBeenCalled();
    expect(calls).toEqual([
      { cmd: "export_data", args: {} },
      { cmd: "save_to_file", args: { path: "D:\\backup.json", content: "{\"items\":[]}" } },
    ]);
  });

  it("imports data and refreshes items and db size", async () => {
    const calls: string[] = [];
    openMock.mockResolvedValue("D:\\backup.json");
    mockIPC((cmd) => {
      calls.push(cmd);
      if (cmd === "read_from_file") return "{\"items\":[]}";
      if (cmd === "get_items") return [];
      if (cmd === "get_db_size") return "1.0 KB";
      return null;
    });

    await useSettingsStore.getState().importData();

    expect(openMock).toHaveBeenCalled();
    expect(calls).toEqual(["read_from_file", "import_data", "get_items", "get_db_size"]);
    expect(useSettingsStore.getState().dbSize).toBe("1.0 KB");
  });
});
