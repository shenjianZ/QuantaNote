import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, setup } from "../../test/test-utils";
import { useSearchStore } from "../../stores/searchStore";
import { CommandPalette } from "./CommandPalette";
import type { Item } from "../../types";

const items: Item[] = [
  {
    id: "item-1",
    type: "note",
    title: "Rust 笔记",
    summary: "Tauri command",
    tags: [],
    time: "刚刚",
    icon: vi.fn(),
    accent: "cyan",
  },
  {
    id: "item-2",
    type: "note",
    title: "React 表单",
    summary: "Testing Library",
    tags: [],
    time: "刚刚",
    icon: vi.fn(),
    accent: "blue",
  },
];

describe("CommandPalette", () => {
  beforeEach(() => {
    useSearchStore.setState({
      query: "",
      results: [],
      searching: false,
    });
  });

  it("renders backend search results and selects with Enter", () => {
    const onClose = vi.fn();
    const onSelectItem = vi.fn();
    useSearchStore.setState({
      query: "rust",
      results: [{ id: "item-1", title: "Rust 笔记", item_type: "note", summary: "Tauri command" }],
    });

    setup(
      <CommandPalette
        open
        onClose={onClose}
        onSelectItem={onSelectItem}
        items={items}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("搜索笔记"), { key: "Enter" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectItem).toHaveBeenCalledWith("item-1");
  });

  it("falls back to local item filtering when backend has no result", () => {
    useSearchStore.setState({ query: "react", results: [] });

    setup(
      <CommandPalette
        open
        onClose={vi.fn()}
        onSelectItem={vi.fn()}
        items={items}
      />,
    );

    expect(screen.getByRole("option")).toHaveTextContent("React 表单");
    expect(screen.getByRole("option")).not.toHaveTextContent("Rust 笔记");
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();

    setup(
      <CommandPalette
        open
        onClose={onClose}
        onSelectItem={vi.fn()}
        items={items}
      />,
    );

    fireEvent.keyDown(screen.getByPlaceholderText("搜索笔记"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the mobile search surface below the status bar safe area", () => {
    setup(
      <CommandPalette
        open
        onClose={vi.fn()}
        onSelectItem={vi.fn()}
        items={items}
      />,
    );

    expect(screen.getByTestId("command-palette-overlay")).toHaveClass("pt-[env(safe-area-inset-top)]");
  });

  it("keeps the desktop search panel opaque over the blurred backdrop", () => {
    setup(
      <CommandPalette
        open
        onClose={vi.fn()}
        onSelectItem={vi.fn()}
        items={items}
      />,
    );

    expect(screen.getByTestId("command-palette-panel")).toHaveClass("bg-[var(--popover)]");
  });

  it("renders the Escape hint without a filled background", () => {
    setup(
      <CommandPalette
        open
        onClose={vi.fn()}
        onSelectItem={vi.fn()}
        items={items}
      />,
    );

    expect(screen.getByText("Esc")).toHaveClass("kbd-plain");
  });
});
