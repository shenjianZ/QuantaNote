import { beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { useSettingsStore } from "../../stores/settingsStore";
import type { VersionDto } from "../../types";
import { VersionPreviewModal } from "./VersionPreviewModal";

const version: VersionDto = {
  id: "version-1",
  item_id: "item-1",
  version_number: 1,
  content: "# 版本预览",
  name: "v1",
  description: "",
  created_at: "2026-01-01",
};

describe("VersionPreviewModal", () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, contentWidthProgress: 0, showDocumentOutline: true },
    }));
  });

  it("shows the shared content width control in the title bar", async () => {
    const { user } = setup(
      <VersionPreviewModal
        open
        version={version}
        onClose={() => {}}
        onRestore={() => {}}
        theme="light"
      />,
    );

    expect(screen.getByTestId("version-preview-content-width-control")).toBeInTheDocument();
    expect(screen.getByTestId("version-preview-layout")).toBeInTheDocument();
    expect(screen.getByTestId("document-outline-item-0")).toHaveTextContent("版本预览");
    await user.click(screen.getByTestId("version-preview-outline-toggle"));
    expect(screen.queryByTestId("document-outline")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "调整内容宽度" }));
    await user.click(screen.getByTestId("version-preview-content-width-control-preset-immersive"));
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(50);
  });
});
