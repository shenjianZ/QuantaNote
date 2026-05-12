import { useCallback, useEffect, useRef, useState } from "react";
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

interface MenuItem {
    icon: React.ReactNode;
    label: string;
    action: () => void;
    gradient: string;
}

const COLLAPSED_SIZE = { width: 64, height: 64 };
const EXPANDED_SIZE = { width: 300, height: 300 };
const BALL_OFFSET_COLLAPSED = { x: 32, y: 32 };
const BALL_OFFSET_EXPANDED = { x: 150, y: 150 };
const MENU_RADIUS = 80;

export function FloatingBall() {
    const { t } = useTranslation("floating-ball");
    const [menuOpen, setMenuOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);
    const isDragging = useRef(false);

    useEffect(() => {
        document.documentElement.classList.add("floating-ball-mode");
        document.body.style.background = "transparent";
        document.body.style.backgroundColor = "transparent";
        return () => {
            document.documentElement.classList.remove("floating-ball-mode");
            document.body.style.background = "";
            document.body.style.backgroundColor = "";
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
        async (e: React.MouseEvent) => {
            e.preventDefault();
            if (menuOpen) return;

            hasMoved.current = false;
            isDragging.current = true;
            dragStartPos.current = { x: e.clientX, y: e.clientY };

            try {
                const win = getCurrentWindow();
                await win.startDragging();
            } catch {
                /* ignore */
            }

            isDragging.current = false;
        },
        [menuOpen],
    );

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        const dx = Math.abs(e.clientX - dragStartPos.current.x);
        const dy = Math.abs(e.clientY - dragStartPos.current.y);
        if (dx >= 5 || dy >= 5) {
            hasMoved.current = true;
        }
    }, []);

    const handleClick = useCallback(() => {
        if (!hasMoved.current && !isDragging.current) {
            setMenuOpen((prev) => !prev);
        }
        hasMoved.current = false;
    }, []);

    // 打开快速笔记窗口
    const openQuickNoteWindow = useCallback(async () => {
        const existing = await WebviewWindow.getByLabel("quick-note");
        if (existing) {
            try {
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
        try {
            getCurrentWindow().close();
        } catch {
            /* ignore */
        }
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
            action: () =>
                window.dispatchEvent(new CustomEvent("quantanote:open-search")),
            gradient: "from-sky-400 to-blue-500",
        },
        {
            icon: <Clock className="h-4 w-4" />,
            label: t("recentNotes"),
            action: () =>
                window.dispatchEvent(new CustomEvent("quantanote:open-recent")),
            gradient: "from-amber-400 to-orange-500",
        },
        {
            icon: <FileText className="h-4 w-4" />,
            label: t("newFullNote"),
            action: () =>
                window.dispatchEvent(new CustomEvent("quantanote:new-note")),
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
                                "radial-gradient(circle at 50% 50%, rgba(0,0,0,0.15) 0%, transparent 50%)",
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
                                }}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                            >
                                <button
                                    type="button"
                                    className={`group relative flex items-center gap-2 rounded-full border border-white/20 bg-white/90 px-3 py-2 text-sm font-medium shadow-lg backdrop-blur-md transition-all duration-200 dark:border-white/10 dark:bg-gray-900/90 ${
                                        isHovered
                                            ? "scale-110 shadow-xl"
                                            : "scale-100 shadow-md"
                                    }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        item.action();
                                        setMenuOpen(false);
                                    }}
                                >
                                    <span
                                        className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${item.gradient} text-white shadow-sm`}
                                    >
                                        {item.icon}
                                    </span>
                                    <span className="text-[var(--text)] whitespace-nowrap pr-1">
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
                    className={`group relative flex h-14 w-14 cursor-grab items-center justify-center rounded-full transition-all duration-300 active:cursor-grabbing ${
                        menuOpen
                            ? "scale-90 rotate-45 shadow-2xl"
                            : "hover:scale-110 hover:shadow-2xl"
                    }`}
                    onMouseDown={handleMouseDown}
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
                            className={`h-5 w-5 transition-transform duration-300 ${
                                menuOpen ? "rotate-90" : ""
                            }`}
                        />
                    </span>

                    {/* 脉冲指示器 */}
                    {!menuOpen && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-red-500 dark:border-gray-900" />
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
}
