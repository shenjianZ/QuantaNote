export const MARKDOWN_STYLE_PRESETS = [
    "notion",
    "paper",
    "obsidian",
    "editorial",
] as const;

export type MarkdownStylePreset = (typeof MARKDOWN_STYLE_PRESETS)[number];

export const DEFAULT_MARKDOWN_STYLE: MarkdownStylePreset = "notion";

export function normalizeMarkdownStyle(value: unknown): MarkdownStylePreset {
    return typeof value === "string" && (MARKDOWN_STYLE_PRESETS as readonly string[]).includes(value)
        ? (value as MarkdownStylePreset)
        : DEFAULT_MARKDOWN_STYLE;
}
