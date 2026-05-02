import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { useSettingsStore } from "../../stores/settingsStore";

const windowMock = vi.hoisted(() => ({
  close: vi.fn(),
  hide: vi.fn(),
  isAlwaysOnTop: vi.fn(),
  isMaximized: vi.fn(),
  minimize: vi.fn(),
  onResized: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  toggleMaximize: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowMock,
}));

import { TopBar } from "./TopBar";

function setWindowSettings(settings: {
  minimizeToTray: boolean;
  closeKeepRunning: boolean;
}) {
  useSettingsStore.setState({
    settings: {
      fontFamily: "Noto Sans SC",
      fontMono: "JetBrains Mono",
      fontSize: 15,
      accentColor: "#386c5f",
      customAccentColors: [],
      minimizeToTray: settings.minimizeToTray,
      closeKeepRunning: settings.closeKeepRunning,
      autoBackup: true,
      autostart: false,
      sqlLogging: {
        enabled: false,
        toConsole: false,
        toFile: true,
        pretty: false,
        maxLen: 4000,
      },
    },
  });
}

function renderTopBar() {
  return setup(
    <TopBar
      currentPage="workspace"
      onNavigate={vi.fn()}
      onOpenSearch={vi.fn()}
    />,
  );
}

describe("TopBar window behavior", () => {
  beforeEach(() => {
    windowMock.close.mockResolvedValue(undefined);
    windowMock.hide.mockResolvedValue(undefined);
    windowMock.isAlwaysOnTop.mockResolvedValue(false);
    windowMock.isMaximized.mockResolvedValue(false);
    windowMock.minimize.mockResolvedValue(undefined);
    windowMock.onResized.mockResolvedValue(() => {});
    windowMock.setAlwaysOnTop.mockResolvedValue(undefined);
    windowMock.toggleMaximize.mockResolvedValue(undefined);
  });

  it("hides to tray when minimizeToTray is enabled", async () => {
    setWindowSettings({ minimizeToTray: true, closeKeepRunning: false });
    const { user } = renderTopBar();

    await user.click(screen.getByTestId("window-minimize"));

    expect(windowMock.hide).toHaveBeenCalledTimes(1);
    expect(windowMock.minimize).not.toHaveBeenCalled();
  });

  it("uses normal minimize when minimizeToTray is disabled", async () => {
    setWindowSettings({ minimizeToTray: false, closeKeepRunning: false });
    const { user } = renderTopBar();

    await user.click(screen.getByTestId("window-minimize"));

    expect(windowMock.minimize).toHaveBeenCalledTimes(1);
    expect(windowMock.hide).not.toHaveBeenCalled();
  });

  it("hides to tray when closeKeepRunning is enabled", async () => {
    setWindowSettings({ minimizeToTray: false, closeKeepRunning: true });
    const { user } = renderTopBar();

    await user.click(screen.getByTestId("window-close"));

    expect(windowMock.hide).toHaveBeenCalledTimes(1);
    expect(windowMock.close).not.toHaveBeenCalled();
  });

  it("closes the app when only minimizeToTray is enabled", async () => {
    setWindowSettings({ minimizeToTray: true, closeKeepRunning: false });
    const { user } = renderTopBar();

    await user.click(screen.getByTestId("window-close"));

    expect(windowMock.close).toHaveBeenCalledTimes(1);
    expect(windowMock.hide).not.toHaveBeenCalled();
    expect(windowMock.minimize).not.toHaveBeenCalled();
  });
});
