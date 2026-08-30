import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { setup, createMockItem } from "../test/test-utils";
import { LibraryPage } from "./LibraryPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { useAttachmentStore } from "../stores/attachmentStore";
import { useTagStore } from "../stores/tagStore";
import { useSearchStore } from "../stores/searchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { MOBILE_BACK_EVENT } from "../utils/platform";
import { formatDateKey } from "../utils/dailyNotes";
import { getNoteBacklinks, getNoteLinks, getRecordDateCounts } from "../services/tauriCommands";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../services/tauriCommands", () => ({
  getItemsPage: vi.fn(async () => ({ items: [], total: 0 })),
  getAllTags: vi.fn(async () => []),
  getAllItemTagMappings: vi.fn(async () => []),
  getNoteLinks: vi.fn(async () => []),
  getNoteBacklinks: vi.fn(async () => []),
  getNoteLinkGraph: vi.fn(async () => ({ nodes: [], edges: [] })),
  getRecordDateCounts: vi.fn(async () => []),
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
  useSettingsStore.setState((state) => ({
    settings: { ...state.settings, contentWidthProgress: 0, showDocumentOutline: true },
  }));
  useItemStore.setState({
    items: [],
    itemTagNames: {},
    libraryTotal: 0,
    libraryLoadingMore: false,
    selectedItem: null,
    fetchLibraryData: vi.fn(async () => ({ items: [], tags: [], mappings: {}, total: 0 })),
    deleteItem: vi.fn(async () => {}),
    cleanupTrash: vi.fn(async () => 0),
    fetchTrashItems: vi.fn(async () => {}),
    restoreItem: vi.fn(async () => {}),
    permanentlyDeleteItem: vi.fn(async () => {}),
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
    query: "",
    results: [],
    total: 0,
    searching: false,
    loadingMore: false,
    hasMore: false,
    search: vi.fn(async () => {}),
    loadMore: vi.fn(async () => {}),
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

  it("uses an underline to indicate the active library tab", async () => {
    const props = makeProps();
    const { user } = setup(<LibraryPage {...props} />);
    const recentTab = screen.getByTestId("library-tab-recent");
    const pinnedTab = screen.getByTestId("library-tab-pinned");

    expect(recentTab).toHaveClass("border-b-2", "border-[var(--accent)]");
    expect(pinnedTab).toHaveClass("border-b-2", "border-transparent");

    await user.click(pinnedTab);

    expect(pinnedTab).toHaveClass("border-b-2", "border-[var(--accent)]");
    expect(recentTab).toHaveClass("border-b-2", "border-transparent");
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
    expect(screen.getByTestId("reader-content-width-control")).toBeInTheDocument();
    expect(screen.getByTestId("reader-preview-layout")).toBeInTheDocument();
    expect(screen.getByTestId("reader-document-outline-toggle")).toBeInTheDocument();

    const event = new Event(MOBILE_BACK_EVENT, { cancelable: true });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.queryByTestId("reader-drawer")).not.toBeInTheDocument();
    });
    expect(event.defaultPrevented).toBe(true);
    expect(props.onPreviewRequestClear).toHaveBeenCalled();
  });

  it("shows forward links and opens the resolved target", async () => {
    vi.mocked(getNoteLinks).mockResolvedValue([{
      source_id: "item-1",
      source_title: "Note A",
      target_title: "Note B",
      target_id: "item-2",
    }]);
    vi.mocked(getNoteBacklinks).mockResolvedValue([]);
    useItemStore.setState({
      selectedItem: {
        ...defaultSelectedItem,
        id: "item-1",
        title: "Note A",
        content: "[[Note B]]",
      },
    });
    const onOpenLinkedNote = vi.fn();
    const props = makeProps({
      selectedItem: createMockItem({ id: "item-1", title: "Note A" }),
      onOpenLinkedNote,
    });
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByText("Note A"));
    await waitFor(() => expect(screen.getByTestId("reader-forward-link")).toBeInTheDocument());
    await user.click(screen.getByTestId("reader-forward-link"));

    expect(onOpenLinkedNote).toHaveBeenCalledWith("Note B", "item-2");
  });

  it("calls onCreateItem when new button clicked", async () => {
    const props = makeProps();
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByText("新建"));
    expect(props.onCreateItem).toHaveBeenCalled();
  });

  it("loads calendar activity and opens the selected daily note", async () => {
    const today = formatDateKey(new Date());
    vi.mocked(getRecordDateCounts).mockResolvedValue([{ date: today, count: 2 }]);
    const onOpenDailyNote = vi.fn();
    const props = makeProps({ onOpenDailyNote });
    const { user } = setup(<LibraryPage {...props} />);

    await user.click(screen.getByTestId("library-calendar-toggle"));
    await waitFor(() => expect(getRecordDateCounts).toHaveBeenCalled());
    await user.click(screen.getByTestId(`library-calendar-day-${today}`));
    expect(screen.getByTestId("library-calendar-selection")).toHaveTextContent(today);
    expect(screen.getByTestId(`library-calendar-count-${today}`)).toHaveTextContent("2");

    await user.click(screen.getByTestId("library-calendar-open-daily"));
    expect(onOpenDailyNote).toHaveBeenCalledWith(today);
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
