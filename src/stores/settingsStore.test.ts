import { mockIPC } from "@tauri-apps/api/mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useItemStore } from "./itemStore";
import { useSettingsStore } from "./settingsStore";

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
    useSettingsStore.setState({
      settings: {
        fontFamily: "Noto Sans SC",
        fontMono: "JetBrains Mono",
        fontSize: 15,
        accentColor: "#386c5f",
        minimizeToTray: true,
        closeKeepRunning: false,
        autoBackup: true,
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
    expect(localStorage.getItem("quantanote-settings")).toContain("#2563eb");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#2563eb");
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
