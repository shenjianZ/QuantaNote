import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { setup, createMockItem } from "../test/test-utils";
import { LibraryPage } from "./LibraryPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { useAttachmentStore } from "../stores/attachmentStore";
import { useTagStore } from "../stores/tagStore";
import { useSearchStore } from "../stores/searchStore";
import { MOBILE_BACK_EVENT } from "../utils/platform";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../services/tauriCommands", () => ({
  getAllItemTagMappings: vi.fn(async () => []),
}));

const defaultSelectedItem = createMockItem();

function makeProps(overrides = {}) {
  return {
    items: [createMockItem({ id: "item-1", title: "Note A" }), createMockItem({ id: "item-2", title: "Note B" })],
    selectedItem: defaultSelectedItem,
    onSelectItem: vi.fn(),
    onCreateItem: vi.fn(),
    onOpenDocument: vi.fn(),
    ...overrides,
  };
}

function setupStores() {
  useAppStore.setState({ theme: "light" });
  useItemStore.setState({
    selectedItem: null,
    deleteItem: vi.fn(async () => {}),
    updateItem: vi.fn(async () => {}),
  });
  useAttachmentStore.setState({
    attachments: [],
    fetchAttachments: vi.fn(),
    addAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  });
  useTagStore.setState({
    tags: [],
    itemTags: [],
    fetchTags: vi.fn(),
    fetchItemTags: vi.fn(),
    updateItemTags: vi.fn(),
  });
  useSearchStore.setState({
    results: [],
    searching: false,
    search: vi.fn(async () => {}),
  });
}

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStores();
  });

  it("renders item list from props", () => {
    const props = makeProps();
    setup(<LibraryPage {...props} />);
    expect(screen.getByText("Note A")).toBeInTheDocument();
    expect(screen.getByText("Note B")).toBeInTheDocument();
  });

  it("filters items by pinned tab", async () => {
    const pinnedItem = createMockItem({ id: "p-1", title: "Pinned Note", pinned: true });
    const normalItem = createMockItem({ id: "n-1", title: "Normal Note", pinned: false });
    const props = makeProps({ items: [pinnedItem, normalItem] });
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByTestId("library-tab-pinned"));
    expect(screen.getByText("Pinned Note")).toBeInTheDocument();
    expect(screen.queryByText("Normal Note")).not.toBeInTheDocument();
  });

  it("filters items by favorite tab", async () => {
    const favItem = createMockItem({ id: "f-1", title: "Fav Note", favorite: true });
    const normalItem = createMockItem({ id: "n-1", title: "Normal Note", favorite: false });
    const props = makeProps({ items: [favItem, normalItem] });
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByTestId("library-tab-favorite"));
    expect(screen.getByText("Fav Note")).toBeInTheDocument();
    expect(screen.queryByText("Normal Note")).not.toBeInTheDocument();
  });

  it("selects item on click and opens reader", async () => {
    const props = makeProps();
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByText("Note A"));
    expect(props.onSelectItem).toHaveBeenCalledWith("item-1");
  });

  it("closes the reader drawer on mobile back", async () => {
    useItemStore.setState({
      selectedItem: {
        ...defaultSelectedItem,
        id: "item-1",
        title: "Note A",
        content: "Body",
      },
    });
    const props = makeProps({
      selectedItem: createMockItem({ id: "item-1", title: "Note A" }),
      onPreviewRequestClear: vi.fn(),
    });
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByText("Note A"));
    expect(screen.getByTestId("reader-drawer")).toBeInTheDocument();

    const event = new Event(MOBILE_BACK_EVENT, { cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.queryByTestId("reader-drawer")).not.toBeInTheDocument();
    });
    expect(event.defaultPrevented).toBe(true);
    expect(props.onPreviewRequestClear).toHaveBeenCalled();
  });

  it("calls onCreateItem when new button clicked", async () => {
    const props = makeProps();
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByText("新建"));
    expect(props.onCreateItem).toHaveBeenCalled();
  });

  it("shows empty state when no items match", () => {
    const props = makeProps({ items: [] });
    setup(<LibraryPage {...props} />);
    expect(screen.getByText("还没有可显示的记录")).toBeInTheDocument();
  });

  it("requires confirmation before deleting a reader item", async () => {
    const deleteItem = vi.fn(async () => {});
    useItemStore.setState({
      selectedItem: {
        ...defaultSelectedItem,
        id: "item-1",
        title: "Note A",
        content: "Body",
      },
      deleteItem,
    });
    const props = makeProps({
      selectedItem: createMockItem({ id: "item-1", title: "Note A" }),
    });
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByText("Note A"));
    await user.click(screen.getByTestId("reader-menu-btn"));
    await user.click(screen.getByTestId("reader-delete-btn"));

    expect(deleteItem).not.toHaveBeenCalled();
    expect(screen.getByTestId("reader-delete-btn")).toHaveTextContent("确认删除");

    await user.click(screen.getByTestId("reader-delete-btn"));
    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith("item-1"));
  });
});
