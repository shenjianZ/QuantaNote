---
title: Markdown Editor
description: The Vditor-based Markdown editor in QuantaNote with instant rendering, toolbar, search, and keyboard shortcuts.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Markdown Editor

QuantaNote uses **Vditor** as its Markdown editing engine. Vditor is a browser-based Markdown editor that supports multiple editing modes. QuantaNote uses **IR (Instant Rendering)** mode as the default, providing a seamless WYSIWYG-like editing experience where Markdown syntax is rendered in real time as you type.

## Editing Modes

Vditor supports three editing modes:

| Mode | Description |
|------|-------------|
| **IR (Instant Rendering)** | The default mode. Markdown syntax is rendered immediately as you type, combining the simplicity of plain text editing with the visual clarity of a formatted preview. |
| **SV (Split View)** | Shows a split pane with raw Markdown on the left and rendered output on the right. Useful for users who prefer to see the raw syntax. |
| **WYSIWYG** | A what-you-see-is-what-you-get mode that hides Markdown syntax entirely, similar to a traditional rich text editor. |

QuantaNote primarily uses IR mode for the best balance of editing speed and visual feedback. The mode can be changed in the editor settings if needed.

## Toolbar Reference

The Vditor toolbar provides quick access to common formatting operations:

| Button | Action | Markdown Syntax |
|--------|--------|----------------|
| Headings (H1-H6) | Insert heading levels | `#`, `##`, `###`, etc. |
| **B** | Bold text | `**bold**` |
| *I* | Italic text | `*italic*` |
| ~~S~~ | Strikethrough text | `~~strikethrough~~` |
| `Code` | Inline code | `` `code` `` |
| Code Block | Insert fenced code block | ` ``` ` |
| Link | Insert hyperlink | `[text](url)` |
| Image | Insert image | `![alt](url)` |
| Ordered List | Numbered list | `1. item` |
| Unordered List | Bullet list | `- item` |
| Check List | Task list | `- [ ] task` |
| Quote | Blockquote | `> quote` |
| Table | Insert table | `\| col1 \| col2 \|` |
| Horizontal Rule | Insert divider | `---` |
| Undo | Undo last action | `Ctrl+Z` |
| Redo | Redo last action | `Ctrl+Y` |
| Fullscreen | Toggle fullscreen editing | `F11` |

## Search and Replace

The editor includes a built-in search and replace bar:

- **Open Search** — Press `Ctrl+F` to open the search bar. Type your query and matches are highlighted in the editor.
- **Open Replace** — Press `Ctrl+H` to open the search and replace bar. Enter a search term and a replacement, then use the replace buttons to substitute matches one at a time or all at once.
- **Navigation** — Use the up/down arrows in the search bar to jump between matches.
- **Close** — Press `Escape` to close the search bar.

## Supported Syntax

QuantaNote supports the full range of Markdown and GFM (GitHub Flavored Markdown) syntax:

- **Headings** — H1 through H6 using `#` notation
- **Emphasis** — Bold, italic, strikethrough
- **Lists** — Ordered, unordered, and task lists (with checkboxes)
- **Code** — Inline code and fenced code blocks with syntax highlighting for common languages
- **Links** — Inline links with optional title text
- **Images** — Inline images with alt text
- **Tables** — GFM tables with alignment support
- **Blockquotes** — Nested blockquotes
- **Horizontal rules** — Section dividers
- **Math** — LaTeX math expressions using `$$` delimiters (if supported by Vditor configuration)
- **Emoji** — Standard emoji shortcodes

## Keyboard Shortcuts

The following keyboard shortcuts are available in the Markdown editor:

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+D` | Strikethrough |
| `Ctrl+`` | Inline code |
| `Ctrl+K` | Insert link |
| `Ctrl+Shift+K` | Insert code block |
| `Ctrl+F` | Find |
| `Ctrl+H` | Find and replace |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save |
| `Ctrl+Enter` | Save (in Workspace) |
| `Ctrl+1` through `Ctrl+6` | Insert heading H1-H6 |
| `Ctrl+Shift+L` | Insert ordered list |
| `Ctrl+L` | Insert unordered list |
| `Tab` | Indent (in lists) |
| `Shift+Tab` | Outdent (in lists) |
