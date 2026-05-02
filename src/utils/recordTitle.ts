export function deriveRecordTitle(content: string): string {
    const text = content.trim();
    if (!text) return "未命名笔记";

    const headings = new Map<number, string>();
    for (const line of text.split(/\r?\n/)) {
        const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line.trim());
        if (!match) continue;

        const level = match[1].length;
        const title = match[2].replace(/\s+#+\s*$/, "").trim();
        if (title && !headings.has(level)) {
            headings.set(level, title);
        }
    }

    for (let level = 1; level <= 6; level += 1) {
        const title = headings.get(level);
        if (title) return title;
    }

    return Array.from(text).slice(0, 10).join("");
}
