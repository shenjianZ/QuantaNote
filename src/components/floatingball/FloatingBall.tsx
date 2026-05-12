import { useCallback, useEffect, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import {
    PenLine,
    Search,
    Clock,
    FileText,
    X,
    Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { loadAllSettings } from "../../services/tauriCommands";

interface MenuItem {
    icon: React.ReactNode;
    label: string;
    action: () => void;
    gradient: string;
}

const COLLAPSED_SIZE = { width: 56, height: 56 };
const EXPANDED_SIZE = { width: 300, height: 300 };
const BALL_OFFSET_COLLAPSED = { x: 28, y: 28 };
const BALL_OFFSET_EXPANDED = { x: 150, y: 150 };
const MENU_RADIUS = 96;
const SETTINGS_CHANGED_EVENT = "quantanote-settings-changed";

interface SettingsChangedPayload {
    key: string;
    value: unknown;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const normalized = hex.replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
}

function applyAccentColor(accentColor: unknown) {
    if (typeof accentColor !== "string") return;
    const rgb = hexToRgb(accentColor);
    if (!rgb) return;
    const root = document.documentElement;
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    root.style.setProperty("--accent-soft", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
}

async function syncAccentColorFromSettings() {
    try {
        const saved = await loadAllSettings();
        const rawSettings = saved["quantanote-settings"];
        if (!rawSettings) return;
        const parsed = JSON.parse(rawSettings) as { accentColor?: unknown };
        applyAccentColor(parsed.accentColor);
    } catch {
        /* use stylesheet defaults */
    }
}

export function FloatingBall() {
    const { t } = useTranslation("floating-ball");
    const [menuOpen, setMenuOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const pointerDown = useRef(false);
    const hasMoved = useRef(false);
    const isDragging = useRef(false);
    const acceptUserMoveEvents = useRef(false);
    const moveTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);
    const moveIdleTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

    useEffect(() => {
        document.documentElement.classList.add("floating-ball-mode");
        document.body.style.background = "transparent";
        document.body.style.backgroundColor = "transparent";
        getCurrentWindow().setBackgroundColor([0, 0, 0, 0]).catch(() => {});
        syncAccentColorFromSettings();
        return () => {
            document.documentElement.classList.remove("floating-ball-mode");
            document.body.style.background = "";
            document.body.style.backgroundColor = "";
        };
    }, []);

    useEffect(() => {
        let active = true;
        let unlisten: (() => void) | undefined;

        listen<SettingsChangedPayload>(SETTINGS_CHANGED_EVENT, (event) => {
            if (event.payload.key === "accentColor") {
                applyAccentColor(event.payload.value);
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
    }, []);

    useEffect(() => {
        const clearPointerState = () => {
            pointerDown.current = false;
        };
        window.addEventListener("mouseup", clearPointerState);
        return () => window.removeEventListener("mouseup", clearPointerState);
    }, []);

    useEffect(() => {
        const win = getCurrentWindow();
        let active = true;
        let unlisten: (() => void) | undefined;

        win.onMoved((position) => {
            if (!acceptUserMoveEvents.current) return;
            if (moveTimer.current) {
                window.clearTimeout(moveTimer.current);
            }
            if (moveIdleTimer.current) {
                window.clearTimeout(moveIdleTimer.current);
            }
            moveTimer.current = window.setTimeout(async () => {
                try {
                    await emit("quantanote-floating-ball-position-changed", {
                        x: Math.round(position.payload.x),
                        y: Math.round(position.payload.y),
                    });
                } catch {
                    /* ignore */
                }
            }, 200);
            moveIdleTimer.current = window.setTimeout(() => {
                acceptUserMoveEvents.current = false;
            }, 800);
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
            if (moveTimer.current) {
                window.clearTimeout(moveTimer.current);
            }
            if (moveIdleTimer.current) {
                window.clearTimeout(moveIdleTimer.current);
            }
        };
    }, []);

    // 动态调整窗口大小：收起时仅球大小，展开时容纳菜单
    useEffect(() => {
        const win = getCurrentWindow();
        let cancelled = false;

        const updateWindow = async () => {
            try {
                const pos = await win.outerPosition();
                const sf = await win.scaleFactor();
                const currentSize = await win.innerSize();
                const logicalSize = currentSize.toLogical(sf);
                const logicalPos = pos.toLogical(sf);

                if (cancelled) return;

                const isCurrentlyExpanded = logicalSize.width > 100;
                const currentOffset = isCurrentlyExpanded
                    ? BALL_OFFSET_EXPANDED
                    : BALL_OFFSET_COLLAPSED;
                const targetOffset = menuOpen
                    ? BALL_OFFSET_EXPANDED
                    : BALL_OFFSET_COLLAPSED;
                const targetSize = menuOpen ? EXPANDED_SIZE : COLLAPSED_SIZE;

                if (Math.abs(logicalSize.width - targetSize.width) < 1) return;

                const newX = logicalPos.x + currentOffset.x - targetOffset.x;
                const newY = logicalPos.y + currentOffset.y - targetOffset.y;

                await win.setSize(new LogicalSize(targetSize.width, targetSize.height));
                await win.setPosition(new LogicalPosition(newX, newY));
            } catch {
                /* ignore */
            }
        };

        updateWindow();
        return () => {
            cancelled = true;
        };
    }, [menuOpen]);

    // 拖拽处理
    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            if (menuOpen) return;

            pointerDown.current = true;
            acceptUserMoveEvents.current = false;
            hasMoved.current = false;
            isDragging.current = false;
            dragStartPos.current = { x: e.screenX, y: e.screenY };
        },
        [menuOpen],
    );

    const handleMouseMove = useCallback(
        async (e: React.MouseEvent) => {
            if (!pointerDown.current || menuOpen || isDragging.current) return;

            const dx = Math.abs(e.screenX - dragStartPos.current.x);
            const dy = Math.abs(e.screenY - dragStartPos.current.y);
            if (dx < 5 && dy < 5) return;

            hasMoved.current = true;
            isDragging.current = true;
            acceptUserMoveEvents.current = true;
            try {
                await getCurrentWindow().startDragging();
            } catch {
                acceptUserMoveEvents.current = false;
                /* ignore */
            } finally {
                pointerDown.current = false;
                window.setTimeout(() => {
                    isDragging.current = false;
                }, 0);
            }
        },
        [menuOpen],
    );

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        if (menuOpen && !pointerDown.current) {
            hasMoved.current = false;
            return;
        }

        pointerDown.current = false;
        const dx = Math.abs(e.screenX - dragStartPos.current.x);
        const dy = Math.abs(e.screenY - dragStartPos.current.y);
        if (dx >= 5 || dy >= 5) {
            hasMoved.current = true;
        }
    }, [menuOpen]);

    const handleClick = useCallback(() => {
        if (menuOpen) {
            setMenuOpen(false);
            hasMoved.current = false;
            return;
        }

        if (!hasMoved.current && !isDragging.current) {
            setMenuOpen((prev) => !prev);
        }
        hasMoved.current = false;
    }, [menuOpen]);

    const emitCommand = useCallback((command: string) => {
        emit("quantanote-floating-ball-command", command).catch(() => {});
    }, []);

    // 打开快速笔记窗口
    const openQuickNoteWindow = useCallback(async () => {
        const existing = await WebviewWindow.getByLabel("quick-note");
        if (existing) {
            try {
                await existing.show();
                await existing.setFocus();
                return;
            } catch {
                /* closed */
            }
        }
        try {
            const baseUrl = window.location.href.split("?")[0];
            new WebviewWindow("quick-note", {
                url: `${baseUrl}?mode=quick-note`,
                title: "QuantaNote - Quick Note",
                width: 520,
                height: 450,
                minWidth: 380,
                minHeight: 320,
                decorations: false,
                alwaysOnTop: true,
                resizable: true,
                center: true,
            });
        } catch {
            /* ignore */
        }
    }, []);

    const handleCloseBall = useCallback(() => {
        emit("quantanote-floating-ball-command", "hide")
            .catch(() => {})
            .finally(() => {
                getCurrentWindow().close().catch(() => {});
            });
    }, []);

    // 菜单项
    const menuItems: MenuItem[] = [
        {
            icon: <PenLine className="h-4 w-4" />,
            label: t("quickNote"),
            action: openQuickNoteWindow,
            gradient: "from-emerald-400 to-teal-500",
        },
        {
            icon: <Search className="h-4 w-4" />,
            label: t("search"),
            action: () => emitCommand("open-search"),
            gradient: "from-sky-400 to-blue-500",
        },
        {
            icon: <Clock className="h-4 w-4" />,
            label: t("recentNotes"),
            action: () => emitCommand("open-recent"),
            gradient: "from-amber-400 to-orange-500",
        },
        {
            icon: <FileText className="h-4 w-4" />,
            label: t("newFullNote"),
            action: () => emitCommand("new-note"),
            gradient: "from-violet-400 to-purple-500",
        },
        {
            icon: <X className="h-4 w-4" />,
            label: t("closeFloatingBall"),
            action: handleCloseBall,
            gradient: "from-rose-400 to-red-500",
        },
    ];

    // 像素级径向菜单定位（展开窗口内，球中心为圆心，上方扇形展开）
    const getItemStyle = (index: number): React.CSSProperties => {
        const total = menuItems.length;
        const startAngle = (-Math.PI * 5) / 6;
        const endAngle = -Math.PI / 6;
        const angle =
            startAngle + ((endAngle - startAngle) * index) / (total - 1);
        const cx = BALL_OFFSET_EXPANDED.x;
        const cy = BALL_OFFSET_EXPANDED.y;

        return {
            position: "absolute",
            left: cx + MENU_RADIUS * Math.cos(angle),
            top: cy + MENU_RADIUS * Math.sin(angle),
            transform: "translate(-50%, -50%)",
        };
    };

    return (
        <div
            className="fixed inset-0"
            style={{ background: "transparent", pointerEvents: "none" }}
        >
            {/* 径向菜单 */}
            {menuOpen && (
                <>
                    {/* 背景遮罩 */}
                    <div
                        className="absolute inset-0 animate-[fadeIn_0.2s_ease-out]"
                        style={{
                            background:
                                "radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb), 0.14) 0%, transparent 52%)",
                            pointerEvents: "none",
                        }}
                    />

                    {/* 菜单项 */}
                    {menuItems.map((item, index) => {
                        const isHovered = hoveredIndex === index;
                        const delay = index * 40;

                        return (
                            <div
                                key={index}
                                style={{
                                    ...getItemStyle(index),
                                    pointerEvents: "auto",
                                    animation: `menuItemIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both`,
                                    zIndex: isHovered ? 30 : 1,
                                }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <button
                                    type="button"
                                    className={`group relative flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 ${
                                        isHovered
                                            ? "scale-110"
                                            : "scale-100"
                                    }`}
                                    aria-label={item.label}
                                    title={item.label}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        item.action();
                                        setMenuOpen(false);
                                    }}
                                >
                                    <span
                                        className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${item.gradient} text-white shadow-sm`}
                                    >
                                        {item.icon}
                                    </span>
                                    <span
                                        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--paper)] px-2 py-1 text-xs font-medium text-[var(--text)] opacity-0 shadow-[0_8px_20px_rgba(var(--accent-rgb),0.18)] backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                                    >
                                        {item.label}
                                    </span>
                                </button>
                            </div>
                        );
                    })}
                </>
            )}

            {/* 悬浮球（始终居中） */}
            <div className="absolute inset-0 flex items-center justify-center">
                <button
                    data-floating-ball
                    type="button"
                    style={{ pointerEvents: "auto" }}
                    className={`group relative flex h-12 w-12 cursor-grab items-center justify-center rounded-full transition-all duration-300 active:cursor-grabbing ${
                        menuOpen
                            ? "scale-90 rotate-45 shadow-2xl"
                            : "hover:scale-110 hover:shadow-2xl"
                    }`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onClick={handleClick}
                    aria-label="Floating Ball Menu"
                >
                    {/* 外圈光晕 */}
                    <span
                        className={`absolute inset-0 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/60 transition-all duration-300 ${
                            menuOpen
                                ? "blur-md opacity-60"
                                : "blur-sm opacity-40 group-hover:opacity-60 group-hover:blur-md"
                        }`}
                    />

                    {/* 主按钮 */}
                    <span
                        className={`relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--accent)]/80 text-white shadow-xl transition-all duration-300 ${
                            menuOpen
                                ? ""
                                : "group-hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.4)]"
                        }`}
                    >
                        <Sparkles
                            className={`h-4 w-4 transition-transform duration-300 ${
                                menuOpen ? "rotate-90" : ""
                            }`}
                        />
                    </span>

                    {/* 脉冲指示器 */}
                </button>
            </div>
        </div>
    );
}
