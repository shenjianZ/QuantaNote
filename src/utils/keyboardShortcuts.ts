const BLOCKED_GLOBAL_SHORTCUT_KEYS = new Set([
    "p",
    "s",
    "u",
    "a",
    "r",
    "g",
    "j",
    "d",
    "e",
    "q",
    "w",
    "t",
    "i",
    "o",
    "z",
    "v",
]);

// Vditor handles these formatting/navigation shortcuts itself. The global
// handler must not cancel them while focus is inside an editor.
const EDITOR_SHORTCUT_KEYS = new Set(["a", "b", "d", "i", "j", "k", "l", "o", "u", "v", "z"]);

export function getSelectedText(target: EventTarget | null): string {
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        if (start === null || end === null || start === end) return "";
        return target.value.slice(Math.min(start, end), Math.max(start, end));
    }

    return window.getSelection()?.toString() ?? "";
}

/**
 * 判断全局快捷键处理器是否应该阻止浏览器默认行为。
 * Ctrl/Cmd+C 和 Ctrl/Cmd+X 必须始终交给 WebView 原生处理，
 * 否则非编辑区的鼠标选中文本可能无法写入系统剪贴板。
 */
export function shouldPreventGlobalShortcut(key: string, isEditor: boolean): boolean {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey === "c" || normalizedKey === "x") {
        return false;
    }

    if (!BLOCKED_GLOBAL_SHORTCUT_KEYS.has(normalizedKey)) {
        return false;
    }

    return !(EDITOR_SHORTCUT_KEYS.has(normalizedKey) && isEditor);
}
