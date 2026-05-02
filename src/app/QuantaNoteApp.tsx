import { useCallback, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { FileText } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { CommandPalette } from "../components/search/CommandPalette";
import { ToastContainer } from "../components/common/ToastContainer";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { WorkspacePage } from "../pages/WorkspacePage";
import { LibraryPage } from "../pages/LibraryPage";
import { DocumentEditorPage } from "../pages/DocumentEditorPage";
import { SettingsPage } from "../pages/SettingsPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { useSettingsStore } from "../stores/settingsStore";
import { adaptItem } from "../adapters/itemAdapter";
import { deriveRecordTitle } from "../utils/recordTitle";
import { preloadVditorResources } from "../utils/vditorPreload";
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
    createdAt: "",
    updatedAt: "",
};

type TrayCommand =
    | "new-note"
    | "open-workspace"
    | "open-library"
    | "open-settings";

function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target.closest("[contenteditable='true']")) return true;
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

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
    const {
        items: dbItems,
        fetchItems,
        selectedItem: selectedDbItem,
        getItem,
        createItem,
    } = useItemStore();
    const [previewRequest, setPreviewRequest] = useState<{
        itemId: string;
        requestId: number;
    } | null>(null);

    useEffect(() => {
        preloadVditorResources();
        useAppStore.getState().init();
        useSettingsStore.getState().init();
    }, []);

    useEffect(() => {
        // LibraryPage 通过 fetchLibraryData 统一加载，这里只在非 library 页面加载
        if (currentPage !== "library") {
            fetchItems().catch(() => {});
        }
    }, [fetchItems, currentPage]);

    useEffect(() => {
        function handleE2eDataChanged() {
            fetchItems().catch(() => {});
        }

        window.addEventListener(
            "quantanote:e2e-data-changed",
            handleE2eDataChanged,
        );
        return () =>
            window.removeEventListener(
                "quantanote:e2e-data-changed",
                handleE2eDataChanged,
            );
    }, [fetchItems]);

    const displayItems: Item[] = useMemo(
        () => dbItems.map(adaptItem),
        [dbItems],
    );

    const selectedItem = useMemo<Item>(() => {
        if (selectedItemId) {
            if (selectedDbItem?.id === selectedItemId)
                return adaptItem(selectedDbItem);
            return (
                displayItems.find((item) => item.id === selectedItemId) ??
                EMPTY_ITEM
            );
        }
        if (selectedDbItem) return adaptItem(selectedDbItem);
        return displayItems[0] ?? EMPTY_ITEM;
    }, [selectedDbItem, displayItems, selectedItemId]);

    const handleSelectItem = useCallback(
        (id: string) => {
            selectItem(id);
            getItem(id).catch(() => {});
        },
        [getItem, selectItem],
    );

    const handlePaletteSelectItem = useCallback(
        (id: string) => {
            selectItem(id);
            getItem(id).catch(() => {});
            setPreviewRequest((current) => ({
                itemId: id,
                requestId: (current?.requestId ?? 0) + 1,
            }));
            navigate("library");
        },
        [getItem, navigate, selectItem],
    );

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

    const handleQuickCreate = useCallback(
        async (content: string) => {
            const text = content.trim();
            if (!text) return;
            const title = deriveRecordTitle(text);
            const item = await createItem(title, "note", text);
            selectItem(item.id);
            await getItem(item.id);
        },
        [createItem, getItem, selectItem],
    );

    // Global keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            // 禁用浏览器默认快捷键，只保留 F12 (DevTools)
            // 注意：Ctrl+F 和 Ctrl+H 保留给应用内搜索，仅阻止浏览器默认行为
            if (mod) {
                // 这些快捷键只阻止浏览器默认行为，不阻止事件传播
                const preventOnlyKeys = ["f", "h"];
                if (preventOnlyKeys.includes(key)) {
                    e.preventDefault();
                    return; // 不阻止传播，让 VditorEditor 处理
                }

                // 其他快捷键完全阻止；编辑区域内保留系统级编辑/剪贴板快捷键。
                const blockedKeys = ["p", "s", "u", "a", "r", "g", "j", "d", "e", "q", "w", "t", "i", "o", "z", "x", "c", "v"];
                const editorKeys = ["a", "z", "x", "c", "v"];
                const isEditor = isEditableShortcutTarget(e.target);
                const hasSelection = !!window.getSelection()?.toString();
                if (blockedKeys.includes(key) && !(editorKeys.includes(key) && (isEditor || (key === "c" && hasSelection)))) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }

            // 禁用 F1-F11, F12 保留
            if (e.key.startsWith("F") && e.key !== "F12") {
                e.preventDefault();
                e.stopPropagation();
            }

            // 应用内快捷键
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
        return () =>
            document.removeEventListener("keydown", handleKeyDown, true);
    }, [paletteOpen, openPalette, closePalette, handleCreateNote]);

    useEffect(() => {
        let active = true;
        let unlisten: (() => void) | undefined;

        listen<TrayCommand>("quantanote-tray-command", (event) => {
            switch (event.payload) {
                case "new-note":
                    handleCreateNote().catch(() => {});
                    break;
                case "open-workspace":
                    navigate("workspace");
                    break;
                case "open-library":
                    navigate("library");
                    break;
                case "open-settings":
                    navigate("settings");
                    break;
            }
        })
            .then((cleanup) => {
                if (active) {
                    unlisten = cleanup;
                } else {
                    cleanup();
                }
            })
            .catch(() => {});

        return () => {
            active = false;
            unlisten?.();
        };
    }, [handleCreateNote, navigate]);

    // 禁用右键菜单（作为 Tauri 配置的补充）
    useEffect(() => {
        function handleContextMenu(e: MouseEvent) {
            e.preventDefault();
        }
        document.addEventListener("contextmenu", handleContextMenu);
        return () => document.removeEventListener("contextmenu", handleContextMenu);
    }, []);

    return (
        <ErrorBoundary>
        <AppShell
            currentPage={currentPage as AppPage}
            onNavigate={navigate}
            onOpenSearch={openPalette}
            itemCount={dbItems.length}
        >
            {currentPage === "workspace" && (
                <WorkspacePage onQuickCreate={handleQuickCreate} />
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
            <ToastContainer />
        </AppShell>
        </ErrorBoundary>
    );
}
