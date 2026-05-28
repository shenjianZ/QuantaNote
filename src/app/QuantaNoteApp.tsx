import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { FileText } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { CommandPalette } from "../components/search/CommandPalette";
import { ToastContainer } from "../components/common/ToastContainer";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { WorkspacePage } from "../pages/WorkspacePage";
import { LibraryPage } from "../pages/LibraryPage";
import { DocumentEditorPage } from "../pages/DocumentEditorPage";
import { SettingsPage } from "../pages/SettingsPage";
import { ProfilePage } from "../pages/ProfilePage";
import { LanguageSetupPage } from "../pages/LanguageSetupPage";
import { useAppStore } from "../stores/appStore";
import { useItemStore } from "../stores/itemStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useSyncStore } from "../stores/syncStore";
import { useToastStore } from "../stores/toastStore";
import type { FloatingBallPosition } from "../stores/settingsStore";
import { adaptItem } from "../adapters/itemAdapter";
import { deriveRecordTitle } from "../utils/recordTitle";
import { preloadVditorResources } from "../utils/vditorPreload";
import { isMobile, MOBILE_BACK_EVENT } from "../utils/platform";
import { nativeLog } from "../utils/nativeLog";
import type { AppPage, Item } from "../types";
import i18n from "../i18n";
import "../styles/themes.css";
import "../styles/global.css";

function getEmptyItem(): Item {
    return {
        id: "",
        type: "note",
        title: i18n.t("common:emptyItem.title"),
        summary: i18n.t("common:emptyItem.summary"),
        tags: [],
        time: "",
        icon: FileText,
        accent: "cyan",
        createdAt: "",
        updatedAt: "",
    };
}

type TrayCommand =
    | "new-note"
    | "open-workspace"
    | "open-library"
    | "open-settings"
    | "show-floating-ball"
    | "hide-floating-ball";

type FloatingBallCommand =
    | "open-search"
    | "open-recent"
    | "new-note"
    | "hide";

const FLOATING_BALL_SIZE = 56;
const FLOATING_BALL_MARGIN = 24;
const FLOATING_BALL_RIGHT_MARGIN = 96;
const SHOW_FLOATING_BALL_EVENT = "quantanote:show-floating-ball-window";
const HIDE_FLOATING_BALL_EVENT = "quantanote:hide-floating-ball-window";
const EXIT_BACK_WINDOW_MS = 2000;
const TOP_LEVEL_PAGES: AppPage[] = ["workspace", "library", "settings"];

interface PhysicalWorkArea {
    left: number;
    top: number;
    right: number;
    bottom: number;
    ballSize: number;
    margin: number;
    rightMargin: number;
}

function isValidFloatingBallPosition(position: FloatingBallPosition | null | undefined): position is FloatingBallPosition {
    return Boolean(
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y),
    );
}

async function getInitialFloatingBallPosition(): Promise<FloatingBallPosition> {
    const saved = useSettingsStore.getState().settings.floatingBallPosition;

    try {
        const [monitors, primary] = await Promise.all([
            availableMonitors(),
            primaryMonitor(),
        ]);
        const workAreas = (monitors.length > 0 ? monitors : primary ? [primary] : [])
            .map((monitor) => {
                const { position, size } = monitor.workArea;
                const scale = monitor.scaleFactor || 1;
                const ballSize = FLOATING_BALL_SIZE * scale;
                const margin = FLOATING_BALL_MARGIN * scale;
                const rightMargin = FLOATING_BALL_RIGHT_MARGIN * scale;
                return {
                    left: position.x,
                    top: position.y,
                    right: position.x + size.width,
                    bottom: position.y + size.height,
                    ballSize,
                    margin,
                    rightMargin,
                };
            });
        if (workAreas.length > 0) {
            const primaryWorkArea = primary
                ? workAreas.find((area) => {
                    return area.left === primary.workArea.position.x &&
                        area.top === primary.workArea.position.y;
                }) ?? workAreas[0]
                : workAreas[0];
            const targetArea = isValidFloatingBallPosition(saved)
                ? workAreas.find((area) => isPositionInWorkArea(saved, area)) ?? primaryWorkArea
                : primaryWorkArea;
            const targetPosition = isValidFloatingBallPosition(saved)
                ? saved
                : {
                    x: targetArea.right - targetArea.ballSize - targetArea.rightMargin,
                    y: targetArea.bottom - targetArea.ballSize - targetArea.margin,
                };
            return clampFloatingBallPosition(targetPosition, targetArea);
        }
    } catch {
        /* fallback to browser screen metrics */
    }

    const scale = window.devicePixelRatio || 1;
    return {
        x: Math.round(Math.max(FLOATING_BALL_MARGIN * scale, (window.screen.availWidth - FLOATING_BALL_SIZE - FLOATING_BALL_RIGHT_MARGIN) * scale)),
        y: Math.round(Math.max(FLOATING_BALL_MARGIN * scale, (window.screen.availHeight - FLOATING_BALL_SIZE - FLOATING_BALL_MARGIN) * scale)),
    };
}

function isPositionInWorkArea(position: FloatingBallPosition, area: PhysicalWorkArea) {
    return (
        position.x >= area.left &&
        position.y >= area.top &&
        position.x + area.ballSize <= area.right &&
        position.y + area.ballSize <= area.bottom
    );
}

function clampFloatingBallPosition(position: FloatingBallPosition, area: PhysicalWorkArea): FloatingBallPosition {
    const minX = area.left + area.margin;
    const minY = area.top + area.margin;
    const maxX = Math.max(minX, area.right - area.ballSize - area.rightMargin);
    const maxY = Math.max(minY, area.bottom - area.ballSize - area.margin);
    return {
        x: Math.round(Math.min(Math.max(position.x, minX), maxX)),
        y: Math.round(Math.min(Math.max(position.y, minY), maxY)),
    };
}

function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    if (target.closest("[contenteditable='true']")) return true;
    return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}

async function requestAppExitFromBackButton() {
    nativeLog("info", "[QuantaNote][mobile-back] exit requested");

    try {
        await invoke("request_app_exit");
        nativeLog("info", "[QuantaNote][mobile-back] request_app_exit resolved");
        return;
    } catch (error) {
        nativeLog("warn", "[QuantaNote][mobile-back] request_app_exit failed", error);
    }

    try {
        await getCurrentWindow().close();
        nativeLog("info", "[QuantaNote][mobile-back] current window close requested");
    } catch (error) {
        nativeLog("warn", "[QuantaNote][mobile-back] current window close failed", error);
    }
}

export function QuantaNoteApp() {
    const {
        currentPage,
        paletteOpen,
        selectedItemId,
        settingsSection,
        navigate,
        goBack,
        openPalette,
        closePalette,
        setSettingsSection,
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
    const hasSelectedLanguage = useSettingsStore((s) => s.hasSelectedLanguage);
    const [initDone, setInitDone] = useState(false);
    const [previewRequest, setPreviewRequest] = useState<{
        itemId: string;
        requestId: number;
    } | null>(null);
    const [readerOpen, setReaderOpen] = useState(false);
    const [anyModalOpen, setAnyModalOpen] = useState(false);
    const lastExitBackAtRef = useRef(0);

    useEffect(() => {
        preloadVditorResources();
        useAppStore.getState().init();
        useSettingsStore.getState().init().finally(() => setInitDone(true));
        useSyncStore.getState().init();
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
                getEmptyItem()
            );
        }
        if (selectedDbItem) return adaptItem(selectedDbItem);
        return displayItems[0] ?? getEmptyItem();
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

    const handleViewLastQuickCreated = useCallback(() => {
        if (selectedItemId) {
            setPreviewRequest((current) => ({
                itemId: selectedItemId,
                requestId: (current?.requestId ?? 0) + 1,
            }));
        }
        navigate("library");
    }, [navigate, selectedItemId]);

    const handleCreateNote = useCallback(async () => {
        const item = await createItem(i18n.t("common:emptyItem.untitled"), "note", "");
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
        if (isMobile()) return;
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
                case "show-floating-ball":
                    window.dispatchEvent(new Event(SHOW_FLOATING_BALL_EVENT));
                    break;
                case "hide-floating-ball":
                    window.dispatchEvent(new Event(HIDE_FLOATING_BALL_EVENT));
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

    // Mobile back button handling
    useEffect(() => {
        if (!isMobile()) return;

        let active = true;
        let unregisterBackButton: (() => void) | undefined;

        function dispatchMobileBackEvent() {
            const event = new Event(MOBILE_BACK_EVENT, { cancelable: true });
            window.dispatchEvent(event);
            return event.defaultPrevented;
        }

        function handleBackButton() {
            nativeLog("info", "[QuantaNote][mobile-back] pressed", {
                currentPage,
                paletteOpen,
                anyModalOpen,
                readerOpen,
                settingsSection,
                topLevel: TOP_LEVEL_PAGES.includes(currentPage as AppPage),
            });

            // P0: CommandPalette 打开 → 关闭
            if (paletteOpen) {
                nativeLog("info", "[QuantaNote][mobile-back] close command palette");
                lastExitBackAtRef.current = 0;
                closePalette();
                return;
            }

            // P1: 任何 Modal 打开 → 交给 Modal.tsx 关闭
            if (dispatchMobileBackEvent()) {
                nativeLog("info", "[QuantaNote][mobile-back] consumed by overlay/modal listener");
                lastExitBackAtRef.current = 0;
                return;
            }
            if (anyModalOpen) {
                nativeLog("warn", "[QuantaNote][mobile-back] modal state is open but no listener consumed event");
                lastExitBackAtRef.current = 0;
                return;
            }

            // P2: 预览抽屉打开 → 关闭
            if (readerOpen) {
                nativeLog("info", "[QuantaNote][mobile-back] close reader fallback from app");
                lastExitBackAtRef.current = 0;
                setReaderOpen(false);
                setPreviewRequest(null);
                return;
            }

            // P3: Settings 分区非默认 → 回到第一个分区
            if (currentPage === "settings" && settingsSection != null && settingsSection !== 0) {
                nativeLog("info", "[QuantaNote][mobile-back] reset settings section", { settingsSection });
                lastExitBackAtRef.current = 0;
                setSettingsSection(0);
                return;
            }

            // P4: 顶级页面 → 两次返回退出应用
            if (TOP_LEVEL_PAGES.includes(currentPage as AppPage)) {
                const now = Date.now();
                const delta = now - lastExitBackAtRef.current;
                nativeLog("info", "[QuantaNote][mobile-back] top-level exit check", {
                    delta,
                    exitWindowMs: EXIT_BACK_WINDOW_MS,
                });
                if (now - lastExitBackAtRef.current <= EXIT_BACK_WINDOW_MS) {
                    requestAppExitFromBackButton();
                    return;
                }
                lastExitBackAtRef.current = now;
                nativeLog("info", "[QuantaNote][mobile-back] first back on top-level page, showing exit hint");
                useToastStore.getState().addToast("info", i18n.t("common:toast.pressBackAgainToExit"));
                return;
            }

            // P5: 有导航历史 → 返回上一页
            nativeLog("info", "[QuantaNote][mobile-back] go back in app history");
            lastExitBackAtRef.current = 0;
            goBack();
        }

        onBackButtonPress(() => {
            nativeLog("info", "[QuantaNote][mobile-back] Tauri onBackButtonPress event");
            handleBackButton();
        })
            .then((listener) => {
                if (active) {
                    unregisterBackButton = () => {
                        listener.unregister().catch(() => {});
                    };
                } else {
                    listener.unregister().catch(() => {});
                }
            })
            .catch(() => {});

        // 键盘 fallback：方便 Android 外接键盘/调试环境触发同一套逻辑
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === "Backspace") {
                // 只在移动端且非输入框时处理
                if (!isEditableShortcutTarget(e.target)) {
                    nativeLog("info", "[QuantaNote][mobile-back] Backspace fallback event");
                    e.preventDefault();
                    e.stopPropagation();
                    handleBackButton();
                }
            }
        }

        document.addEventListener("keydown", handleKeyDown, true);
        return () => {
            active = false;
            unregisterBackButton?.();
            document.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [paletteOpen, closePalette, anyModalOpen, readerOpen, currentPage, settingsSection, setSettingsSection, goBack]);

    // Floating ball window lifecycle
    const floatingBallRef = useRef<WebviewWindow | null>(null);

    const closeFloatingBallWindow = useCallback(async () => {
        const win = floatingBallRef.current;
        if (win) {
            try { await win.close(); } catch { /* already closed */ }
            floatingBallRef.current = null;
        }
    }, []);

    const hideFloatingBallWindow = useCallback(async () => {
        const win = floatingBallRef.current;
        if (win) {
            try { await win.hide(); } catch { /* already hidden or closed */ }
        }
    }, []);

    const openFloatingBallWindow = useCallback(async () => {
        const existing = floatingBallRef.current;
        if (existing) {
            try {
                const position = await getInitialFloatingBallPosition();
                await existing.setPosition(new PhysicalPosition(position.x, position.y));
                await existing.show();
                await existing.setFocus();
                return;
            } catch { /* window may have been closed */ }
        }

        try {
            const baseUrl = window.location.href.split("?")[0];
            const position = await getInitialFloatingBallPosition();
            const win = new WebviewWindow("floating-ball", {
                url: `${baseUrl}?mode=floating-ball`,
                title: "QuantaNote Floating Ball",
                width: FLOATING_BALL_SIZE,
                height: FLOATING_BALL_SIZE,
                decorations: false,
                transparent: true,
                shadow: false,
                backgroundColor: [0, 0, 0, 0],
                alwaysOnTop: true,
                resizable: false,
                skipTaskbar: true,
                visible: false,
                focus: false,
            });
            floatingBallRef.current = win;
            win.once("tauri://created", () => {
                win.setBackgroundColor([0, 0, 0, 0]).catch(() => {});
                win.setPosition(new PhysicalPosition(position.x, position.y)).catch(() => {});
                win.show().catch(() => {});
            }).catch(() => {});
            win.once("tauri://error", () => {
                floatingBallRef.current = null;
            });
            win.once("tauri://destroyed", () => {
                floatingBallRef.current = null;
            }).catch(() => {});
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (isMobile()) return;
        const showFloatingBall = () => {
            useSettingsStore.getState().updateSetting("floatingBall", true);
            openFloatingBallWindow();
        };
        const hideFloatingBall = () => {
            hideFloatingBallWindow();
        };

        window.addEventListener(SHOW_FLOATING_BALL_EVENT, showFloatingBall);
        window.addEventListener(HIDE_FLOATING_BALL_EVENT, hideFloatingBall);
        return () => {
            window.removeEventListener(SHOW_FLOATING_BALL_EVENT, showFloatingBall);
            window.removeEventListener(HIDE_FLOATING_BALL_EVENT, hideFloatingBall);
        };
    }, [openFloatingBallWindow, hideFloatingBallWindow]);

    // 监听悬浮球设置变化
    const floatingBallEnabled = useSettingsStore((s) => s.settings.floatingBall);
    const floatingBallPosition = useSettingsStore((s) => s.settings.floatingBallPosition);
    const prevFloatingBallRef = useRef(floatingBallEnabled);

    useEffect(() => {
        if (isMobile()) return;
        const prev = prevFloatingBallRef.current;
        const current = floatingBallEnabled;

        if (current && !prev) {
            openFloatingBallWindow();
        } else if (!current && prev) {
            closeFloatingBallWindow();
        }
        prevFloatingBallRef.current = current;
    }, [floatingBallEnabled, openFloatingBallWindow, closeFloatingBallWindow]);

    useEffect(() => {
        if (isMobile()) return;
        if (!floatingBallEnabled || !isValidFloatingBallPosition(floatingBallPosition)) return;
        floatingBallRef.current
            ?.setPosition(new PhysicalPosition(floatingBallPosition.x, floatingBallPosition.y))
            .catch(() => {});
    }, [floatingBallEnabled, floatingBallPosition]);

    // 首次加载时检查
    useEffect(() => {
        if (isMobile()) return;
        if (floatingBallEnabled) {
            openFloatingBallWindow();
        }
        return () => {
            closeFloatingBallWindow();
        };
    }, []);

    // 监听悬浮球发出的事件
    useEffect(() => {
        if (isMobile()) return;
        let active = true;
        let unlistenCommand: (() => void) | undefined;
        let unlistenPosition: (() => void) | undefined;

        listen<FloatingBallCommand>("quantanote-floating-ball-command", (event) => {
            switch (event.payload) {
                case "open-search":
                    openPalette();
                    break;
                case "open-recent":
                    navigate("library");
                    break;
                case "new-note":
                    handleCreateNote().catch(() => {});
                    break;
                case "hide":
                    useSettingsStore.getState().updateSetting("floatingBall", false);
                    break;
            }
        })
            .then((cleanup) => {
                if (active) {
                    unlistenCommand = cleanup;
                } else {
                    cleanup();
                }
            })
            .catch(() => {});

        listen<FloatingBallPosition>("quantanote-floating-ball-position-changed", (event) => {
            if (!isValidFloatingBallPosition(event.payload)) return;
            const current = useSettingsStore.getState().settings.floatingBallPosition;
            if (current?.x === event.payload.x && current?.y === event.payload.y) return;
            useSettingsStore.getState().updateSetting("floatingBallPosition", event.payload);
        })
            .then((cleanup) => {
                if (active) {
                    unlistenPosition = cleanup;
                } else {
                    cleanup();
                }
            })
            .catch(() => {});

        return () => {
            active = false;
            unlistenCommand?.();
            unlistenPosition?.();
        };
    }, [openPalette, navigate, handleCreateNote]);

    // 禁用右键菜单（作为 Tauri 配置的补充）
    useEffect(() => {
        function handleContextMenu(e: MouseEvent) {
            e.preventDefault();
        }
        document.addEventListener("contextmenu", handleContextMenu);
        return () => document.removeEventListener("contextmenu", handleContextMenu);
    }, []);

    if (!initDone) return null;

    if (!hasSelectedLanguage) {
        return (
            <ErrorBoundary>
                <LanguageSetupPage onComplete={() => {}} />
                <ToastContainer />
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
        <AppShell
            currentPage={currentPage as AppPage}
            onNavigate={navigate}
            onOpenSearch={openPalette}
            onNewNote={handleCreateNote}
            itemCount={dbItems.length}
        >
            {currentPage === "workspace" && (
                <WorkspacePage
                    onQuickCreate={handleQuickCreate}
                    onViewSaved={handleViewLastQuickCreated}
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
                    onReaderOpenChange={setReaderOpen}
                    onModalStateChange={setAnyModalOpen}
                />
            )}
            {currentPage === "document" && (
                <DocumentEditorPage
                    onBackToPreview={handleBackToPreview}
                    onModalStateChange={setAnyModalOpen}
                />
            )}
            {currentPage === "settings" && (
                <SettingsPage theme={theme} onThemeChange={setTheme} />
            )}
            {currentPage === "profile" && (
                <ProfilePage onNavigate={navigate} />
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
