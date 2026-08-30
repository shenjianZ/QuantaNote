---
title: Command Palette
description: Search notes and run page-aware actions with Ctrl+K in QuantaNote.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# Command Palette

The Command Palette is QuantaNote's keyboard entry point. Press `Ctrl + K` (`Command + K` on macOS) to open it; it does not take over typing while the editor body is focused.

## Opening and Searching

| Action | Shortcut | Description |
|---|---|---|
| Open/close | `Ctrl + K` | Toggle the palette outside editable areas |
| Close | `Esc` | Close the palette without changing the page |

Type a query to filter note titles and full-text search results. Click a result, or use `↑` / `↓` and press `Enter` to open it; the app navigates to Library and opens the reader.

## Available Commands

Commands are page-aware:

| Page | Available actions |
|---|---|
| Every page | New note, Open Settings |
| Document Editor | Save current note, Insert image, Manage attachments, Open version history, Copy note |
| Library (when a note is selected) | Manage attachments, Copy note |

Insert image reuses the editor's image-attachment flow and inserts the image at the saved caret position. Manage attachments opens the current note's attachment manager. Restore a version only opens version history; choose a specific version there to confirm the restore.

## Keyboard Flow

```text
Ctrl + K → type a command or note query → arrow keys → Enter
```

Commands and search results share the same arrow-key selection model. Commands match their label and description while note results continue to use full-text search, so both kinds of entries can appear for one query.

## Changing Shortcuts

Open Settings → Shortcuts to customize the Command Palette and other application shortcuts. Duplicate combinations show a conflict warning; after clearing a binding, that command remains available through the palette or another entry point. Shortcut settings use `Mod`, which is displayed as `Ctrl` or `Command` for the current platform.
