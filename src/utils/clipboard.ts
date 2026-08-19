import { invoke } from "@tauri-apps/api/core";

async function copyWithBrowserApi(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // 某些 WebView 或受限环境不提供可写的 Clipboard API，继续尝试兼容回退。
        }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        if (!document.execCommand("copy")) {
            throw new Error("浏览器剪贴板复制失败");
        }
    } finally {
        textarea.remove();
    }
}

/**
 * 将文本写入系统剪贴板。
 * Windows/Tauri 优先使用宿主窗口句柄写入，确保 Windows Clipboard History
 * （Win+V）能够识别这次复制；浏览器和其他平台回退到 Web Clipboard API。
 */
export async function copyTextToSystemClipboard(text: string): Promise<void> {
    try {
        await invoke("write_clipboard_text", { text });
        return;
    } catch {
        await copyWithBrowserApi(text);
    }
}
