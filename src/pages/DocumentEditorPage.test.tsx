import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../test/test-utils";
import { DocumentEditorPage } from "./DocumentEditorPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { mockIPC } from "@tauri-apps/api/mocks";

vi.mock("../components/editor/VditorEditor", () => ({
  VditorEditor: vi.fn(({ initialValue, onChange, theme }) => {
    const React = require("react");
    const ref = React.useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(
      ref,
      () => ({
        getValue: () => initialValue,
        focus: () => {},
      }),
      [initialValue]
    );
    return React.createElement("textarea", {
      "data-testid": "vditor",
      value: initialValue,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
      "data-theme": theme,
    });
  }),
}));

describe("DocumentEditorPage", () => {
  const onBackToPreview = vi.fn();
  const updateItemMock = vi.fn(async () => {});

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();

    useAppStore.setState({ selectedItemId: "item-1", theme: "light" });
    useItemStore.setState({
      selectedItem: {
        id: "item-1",
        title: "测试文档",
        item_type: "note",
        content: "初始内容",
        summary: "",
        pinned: false,
        favorite: false,
        encrypted: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      getItem: vi.fn(async () => {}),
      updateItem: updateItemMock,
    });

    mockIPC((cmd) => {
      if (cmd === "get_versions") return [];
      if (cmd === "create_version") return { id: "ver-1", version_number: 1, content: "c", name: "v1", description: "", created_at: new Date().toISOString() };
      return null;
    });
  });

  it("loads title from selectedItem", () => {
    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const input = screen.getByPlaceholderText("文档标题") as HTMLInputElement;
    expect(input.value).toBe("测试文档");
  });

  it("shows saved status initially", () => {
    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("shows saving status after edit", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);

    const input = screen.getByPlaceholderText("文档标题");
    await user.clear(input);
    await user.type(input, "新标题");

    expect(screen.getByText("保存中...")).toBeInTheDocument();
  });

  it("creates version on save version click", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    await user.click(screen.getByTitle("保存为新版本"));
    expect(screen.getByText(/版本 \(1\)/)).toBeInTheDocument();
  });

  it("toggles favorite on star click", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    await user.click(screen.getByRole("switch", { name: "收藏" }));
    expect(updateItemMock).toHaveBeenCalledWith("item-1", { favorite: true });
  });
});
