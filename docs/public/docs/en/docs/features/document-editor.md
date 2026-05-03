---
title: Document Editor
description: The full-screen editing experience in QuantaNote with auto-save, version history, and a rich toolbar.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Document Editor

The Document Editor is QuantaNote's full-screen editing environment. It provides a distraction-free space for writing and editing your notes with a rich Markdown toolbar, auto-save functionality, version history, and quick access to item metadata.

## Title and Summary

At the top of the Document Editor, you will find two editable fields:

- **Title** — The main title of your item. This field is pre-filled with the auto-extracted title when the item was created. Edit it at any time to rename your note.
- **Summary** — An optional short description or abstract of the item. The summary is displayed on Library cards and in search results to give you a quick preview of the content.

Both fields save automatically when you navigate away or trigger an auto-save cycle.

## Vditor Editor

The main editing area is powered by **Vditor**, a feature-rich Markdown editor running in IR (Instant Rendering) mode. This provides a WYSIWYG-like experience where Markdown syntax is rendered as you type, giving you a live preview of your formatted content.

Key capabilities of the Vditor editor include:

- Full Markdown toolbar with formatting buttons
- Instant rendering of headings, bold, italic, lists, code blocks, tables, and links
- Image and link insertion dialogs
- Blockquote and horizontal rule support
- Multiple editing modes (see [Markdown Editor](./markdown-editor.md) for details)

For a complete reference of toolbar buttons and keyboard shortcuts, see the [Markdown Editor](./markdown-editor.md) feature page.

## Auto-Save

The Document Editor automatically saves your changes using a debounced save mechanism:

1. **Debounce Timer** — After you stop typing, a timer starts (typically 1-2 seconds). If no further changes are made before the timer expires, the save is triggered.
2. **Status Indicator** — A save status indicator is displayed in the editor UI:
   - **"Saving..."** — Changes are being written to the database.
   - **"Saved"** — All changes have been persisted successfully.
   - **"Unsaved changes"** — There are pending changes waiting for the debounce timer.
3. **Manual Save** — You can also press `Ctrl+S` to force an immediate save.

Auto-save ensures you never lose your work, even if you forget to save manually.

## Favorite Toggle

A star icon in the editor toolbar allows you to toggle the favorite status of the current item. When an item is favorited:

- The star icon is filled/highlighted.
- The item appears in the **Favorites** tab in the Library.
- The favorite status is saved immediately.

Click the star again to remove the item from favorites.

## Version Panel

The Document Editor includes a side panel for version history. Open it by clicking the **Version History** button in the toolbar or pressing the designated shortcut.

The Version Panel displays:

- A chronological list of all versions for the current item.
- Each version shows its timestamp, optional name, and description.
- Actions to preview, compare (diff), or restore any version.

For full details on version management, see the [Version History](./version-history.md) feature page.

## Navigation Back

A back arrow button is located in the top-left corner of the Document Editor. Clicking it returns you to the Library page. Any unsaved changes are auto-saved before navigating away, ensuring no data is lost.

You can also use the browser-style `Alt+Left` shortcut to navigate back.
