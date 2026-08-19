import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { setup } from "../test/test-utils";
import { DocumentEditorPage } from "./DocumentEditorPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { useSettingsStore } from "../stores/settingsStore";
import { mockIPC } from "@tauri-apps/api/mocks";

const { scrollToHeadingMock } = vi.hoisted(() => ({ scrollToHeadingMock: vi.fn() }));

vi.mock("../components/editor/VditorEditor", () => {
  const React = require("react");
  return {
    VditorEditor: React.forwardRef(({ initialValue, onChange, theme }, ref) => {
      React.useImperativeHandle(
        ref,
        () => ({
          getValue: () => initialValue,
          focus: () => {},
          scrollToHeading: scrollToHeadingMock,
        }),
        [initialValue],
      );
      return React.createElement("textarea", {
        "data-testid": "vditor",
        value: initialValue,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value),
        "data-theme": theme,
      });
    }),
  };
});

describe("DocumentEditorPage", () => {
  const onBackToPreview = vi.fn();
  const updateItemMock = vi.fn(async () => {});
  let mockedVersions: unknown[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockedVersions = [];

    useAppStore.setState({ selectedItemId: "item-1", theme: "light" });
    useItemStore.setState({
      selectedItem: {
        id: "item-1",
        title: "测试文档",
        item_type: "note",
        content: "初始内容",
        summary: "初始摘要",
        pinned: false,
        favorite: false,
        encrypted: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      getItem: vi.fn(async () => {}),
      updateItem: updateItemMock,
    });
    useSettingsStore.setState((state) => ({
      settings: { ...state.settings, contentWidthProgress: 0 },
    }));

    mockIPC((cmd) => {
      if (cmd === "get_versions") return mockedVersions;
      if (cmd === "create_version") return { id: "ver-1", version_number: 1, content: "c", name: "v1", description: "", created_at: new Date().toISOString() };
      return null;
    });
  });

  it("loads title from selectedItem", () => {
    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const input = screen.getByPlaceholderText("文档标题") as HTMLInputElement;
    expect(input.value).toBe("测试文档");
  });

  it("loads summary from selectedItem", () => {
    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const input = screen.getByPlaceholderText("摘要") as HTMLTextAreaElement;
    expect(input.value).toBe("初始摘要");
  });

  it("refreshes same-id selectedItem updates", async () => {
    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);

    act(() => {
      const current = useItemStore.getState().selectedItem;
      if (!current) throw new Error("selectedItem is missing");
      useItemStore.setState({
        selectedItem: {
          ...current,
          title: "服务端最新标题",
          content: "服务端最新内容",
        },
      });
    });

    await waitFor(() => {
      expect((screen.getByTestId("doc-title-input") as HTMLInputElement).value).toBe("服务端最新标题");
      expect((screen.getByTestId("vditor") as HTMLTextAreaElement).value).toBe("服务端最新内容");
    });
  });

  it("shows saved status initially", () => {
    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    expect(screen.getByText("已保存")).toBeInTheDocument();
  });

  it("shows the shared content width control", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    expect(screen.getByTestId("document-editor-content-width-control")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "调整内容宽度" }));
    await user.click(screen.getByTestId("document-editor-content-width-control-preset-immersive"));
    expect(useSettingsStore.getState().settings.contentWidthProgress).toBe(50);
  });

  it("places the title beside preview, moves summary to the sidebar, and toggles the outline", async () => {
    const current = useItemStore.getState().selectedItem;
    if (!current) throw new Error("selectedItem is missing");
    useItemStore.setState({
      selectedItem: {
        ...current,
        content: "# 一级标题\n\n## 二级标题",
      },
    });

    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const toolbar = screen.getByTestId("document-editor-toolbar");
    expect(toolbar).toContainElement(screen.getByTestId("doc-title-input"));
    expect(toolbar).not.toHaveTextContent("字");
    expect(screen.getByTestId("document-editor-sidebar")).toBeInTheDocument();
    expect(screen.getByText("描述")).toBeInTheDocument();
    expect(await screen.findByTestId("document-outline-item-1")).toHaveTextContent("二级标题");

    await user.click(screen.getByTestId("document-outline-item-1"));
    expect(scrollToHeadingMock).toHaveBeenCalledWith(1);

    await user.click(screen.getByTestId("document-outline-toggle"));
    expect(screen.queryByTestId("document-outline-item-1")).not.toBeInTheDocument();
    expect(useSettingsStore.getState().settings.showDocumentOutline).toBe(false);

    await user.click(screen.getByTestId("document-outline-toggle"));
    expect(await screen.findByTestId("document-outline-item-1")).toBeInTheDocument();
  });

  it("shows saving status after edit", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);

    const input = screen.getByPlaceholderText("文档标题");
    await user.clear(input);
    await user.type(input, "新标题");

    expect(screen.getByText("保存中...")).toBeInTheDocument();
  });

  it("auto-saves summary edits", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const input = screen.getByPlaceholderText("摘要");

    await user.clear(input);
    await user.type(input, "新的摘要");

    await waitFor(
      () => expect(updateItemMock).toHaveBeenLastCalledWith("item-1", {
        title: "测试文档",
        summary: "新的摘要",
        content: "初始内容",
      }),
      { timeout: 1500 },
    );
  });

  it("creates version on save version click", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const button = await screen.findByTitle("保存为新版本");
    await user.click(button);
    expect(screen.getByText(/版本 \(1\)/)).toBeInTheDocument();
  });

  it("disables save version when current content matches latest version", async () => {
    mockedVersions = [{
      id: "ver-latest",
      item_id: "item-1",
      version_number: 1,
      content: "初始内容",
      change_summary: "初始版本",
      name: "v1",
      description: "",
      created_at: "2026-01-01",
    }];

    setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);

    const button = await screen.findByTitle("当前内容与最新版本一致");
    expect(button).toBeDisabled();
  });

  it("enables save version after content differs from latest version", async () => {
    mockedVersions = [{
      id: "ver-latest",
      item_id: "item-1",
      version_number: 1,
      content: "初始内容",
      change_summary: "初始版本",
      name: "v1",
      description: "",
      created_at: "2026-01-01",
    }];

    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    const editor = await screen.findByTestId("vditor");

    await user.clear(editor);
    await user.type(editor, "改动后的内容");

    expect(screen.getByTitle("保存为新版本")).toBeEnabled();
  });

  it("toggles favorite on star click", async () => {
    const { user } = setup(<DocumentEditorPage onBackToPreview={onBackToPreview} />);
    await user.click(screen.getByRole("switch", { name: "收藏" }));
    expect(updateItemMock).toHaveBeenCalledWith("item-1", { favorite: true });
  });
});
