import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { CommandPalette } from "../components/search/CommandPalette";
import { WorkspacePage } from "../pages/WorkspacePage";
import { LibraryPage } from "../pages/LibraryPage";
import { DocumentEditorPage } from "../pages/DocumentEditorPage";
import { SettingsPage } from "../pages/SettingsPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { adaptItem } from "../adapters/itemAdapter";
import type { AppPage, Item } from "../types";
import "../styles/themes.css";
import "../styles/global.css";

const EMPTY_ITEM: Item = {
  id: "",
  type: "note",
  title: "选择一条记录",
  summary: "从左侧列表选择或创建新记录",
  tags: [],
  time: "",
  icon: FileText,
  accent: "cyan",
};

export function QuantaNoteApp() {
  const {
    currentPage,
    paletteOpen,
    selectedItemId,
    navigate,
    openPalette,
    closePalette,
    theme,
    setTheme,
    selectItem,
  } = useAppStore();
  const { items: dbItems, fetchItems, selectedItem: selectedDbItem, getItem, createItem } = useItemStore();
  const [previewRequest, setPreviewRequest] = useState<{
    itemId: string;
    requestId: number;
  } | null>(null);

  useEffect(() => {
    fetchItems().catch(() => {});
  }, [fetchItems]);

  useEffect(() => {
    function handleE2eDataChanged() {
      fetchItems().catch(() => {});
    }

    window.addEventListener("quantanote:e2e-data-changed", handleE2eDataChanged);
    return () => window.removeEventListener("quantanote:e2e-data-changed", handleE2eDataChanged);
  }, [fetchItems]);

  const displayItems: Item[] = useMemo(() => dbItems.map(adaptItem), [dbItems]);

  const selectedItem = useMemo<Item>(() => {
    if (selectedItemId) {
      if (selectedDbItem?.id === selectedItemId) return adaptItem(selectedDbItem);
      return displayItems.find((item) => item.id === selectedItemId) ?? EMPTY_ITEM;
    }
    if (selectedDbItem) return adaptItem(selectedDbItem);
    return displayItems[0] ?? EMPTY_ITEM;
  }, [selectedDbItem, displayItems, selectedItemId]);

  const handleSelectItem = useCallback((id: string) => {
    selectItem(id);
    getItem(id).catch(() => {});
  }, [getItem, selectItem]);

  const handlePaletteSelectItem = useCallback((id: string) => {
    selectItem(id);
    getItem(id).catch(() => {});
    setPreviewRequest((current) => ({
      itemId: id,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    navigate("library");
  }, [getItem, navigate, selectItem]);

  const handlePreviewItemOpen = useCallback((id: string) => {
    setPreviewRequest((current) => ({
      itemId: id,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, []);

  const handlePreviewRequestClear = useCallback(() => {
    setPreviewRequest(null);
  }, []);

  const handleBackToPreview = useCallback(() => {
    if (selectedItemId) {
      setPreviewRequest((current) => ({
        itemId: selectedItemId,
        requestId: (current?.requestId ?? 0) + 1,
      }));
    }
    navigate("library");
  }, [navigate, selectedItemId]);

  const handleCreateNote = useCallback(async () => {
    const item = await createItem("未命名笔记", "note", "");
    selectItem(item.id);
    await getItem(item.id);
    navigate("document");
  }, [createItem, getItem, navigate, selectItem]);

  const handleQuickCreate = useCallback(async (content: string) => {
    const text = content.trim();
    if (!text) return;
    const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "未命名笔记";
    const title = firstLine.length > 32 ? `${firstLine.slice(0, 32)}...` : firstLine;
    const item = await createItem(title, "note", text);
    selectItem(item.id);
    await getItem(item.id);
  }, [createItem, getItem, selectItem]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "k") {
        e.preventDefault();
        if (paletteOpen) closePalette();
        else openPalette();
      }
      if (mod && key === "n") {
        e.preventDefault();
        handleCreateNote().catch(() => {});
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [paletteOpen, openPalette, closePalette, handleCreateNote]);

  return (
    <AppShell
      currentPage={currentPage as AppPage}
      onNavigate={navigate}
      onOpenSearch={openPalette}
    >
      {currentPage === "workspace" && (
        <WorkspacePage
          onQuickCreate={handleQuickCreate}
        />
      )}
      {currentPage === "library" && (
        <LibraryPage
          items={displayItems}
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          onCreateItem={handleCreateNote}
          onOpenDocument={() => navigate("document")}
          previewRequest={previewRequest}
          onPreviewItemOpen={handlePreviewItemOpen}
          onPreviewRequestClear={handlePreviewRequestClear}
        />
      )}
      {currentPage === "document" && (
        <DocumentEditorPage onBackToPreview={handleBackToPreview} />
      )}
      {currentPage === "settings" && (
        <SettingsPage theme={theme} onThemeChange={setTheme} />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        onSelectItem={handlePaletteSelectItem}
        items={displayItems}
      />
    </AppShell>
  );
}
