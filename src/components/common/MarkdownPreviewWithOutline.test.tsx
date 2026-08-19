import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { useSettingsStore } from "../../stores/settingsStore";
import { MarkdownPreviewWithOutline } from "./MarkdownPreviewWithOutline";

describe("MarkdownPreviewWithOutline", () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, showDocumentOutline: true },
    }));
  });

  it("renders the outline beside markdown and scrolls to the selected heading", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    const { user } = setup(
      <MarkdownPreviewWithOutline
        content={"# 一级标题\n\n## 二级标题"}
        theme="light"
      />,
    );

    expect(screen.getByTestId("markdown-preview-layout")).toBeInTheDocument();
    expect(screen.getByTestId("document-outline-item-1")).toHaveTextContent("二级标题");

    await user.click(screen.getByTestId("document-outline-item-1"));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("removes the outline column when it is hidden", () => {
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, showDocumentOutline: false },
    }));

    setup(
      <MarkdownPreviewWithOutline content="# 标题" theme="light" />,
    );

    expect(screen.getByTestId("markdown-preview-layout")).toHaveClass("min-w-0");
    expect(screen.queryByTestId("document-outline")).not.toBeInTheDocument();
  });
});
