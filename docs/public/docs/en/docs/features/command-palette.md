---
title: Command Palette
description: Global quick-access tool for searching and navigating across all items with Ctrl+K in QuantaNote.
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Command Palette

The Command Palette is QuantaNote's global quick-access tool. Press **Ctrl+K** from anywhere in the application to open a search overlay that lets you instantly find and navigate to any item in your collection. It is designed for power users who want to move fast without taking their hands off the keyboard.

## Opening

To open the Command Palette:

- Press **Ctrl+K** on your keyboard.
- The palette appears as a modal overlay centered on the screen with a search input field automatically focused.

To close the Command Palette without taking any action:

- Press **Escape**.
- Click outside the palette overlay.
- Press **Ctrl+K** again (toggle behavior).

The Command Palette can be opened from any page in the application — Workspace, Library, Document Editor, or Settings — making it a truly global navigation tool.

## Searching

Once the Command Palette is open:

1. **Start typing** — As you type, results are filtered in real time using the full-text search engine. The search matches against item titles and content.
2. **Results list** — Matching items are displayed below the search input in a scrollable list. Each result shows:
   - **Title** — The item's title.
   - **Summary preview** — A short snippet of the item's content or summary.
   - **Type icon** — An icon indicating the item type.
   - **Timestamp** — When the item was last updated.
3. **Keyboard navigation** — Use the **up/down arrow keys** to navigate through the results list. The currently selected result is highlighted.
4. **Quick open** — Press **Enter** to open the selected result. This navigates to the Document Editor for that item.

### When No Results Are Found

If your search query does not match any items, the palette displays a "No results found" message. Try broadening your search terms or checking for typos.

## Navigation

The Command Palette supports several navigation patterns:

### Opening an Item

- Click a result in the list, or use arrow keys + Enter to open it.
- The application navigates to the **Document Editor** for the selected item.
- The Command Palette closes automatically.

### Recent Items

When the Command Palette is opened with an empty search query (i.e., you press Ctrl+K without typing anything):

- A list of **recently accessed items** is displayed.
- These are items you have recently viewed or edited, helping you quickly jump back to your current work.
- The recent items list updates dynamically based on your activity.

### Cross-Page Navigation

The Command Palette works across all pages:

| Current Page | Result Click Action |
|-------------|-------------------|
| Workspace | Navigate to Document Editor for the selected item |
| Library | Navigate to Document Editor for the selected item |
| Document Editor | Switch to the selected item (replaces current editor content) |
| Settings | Navigate to Document Editor for the selected item |

### Tips for Power Users

- **Muscle memory** — Train yourself to use `Ctrl+K` instead of browsing the Library. It is almost always faster.
- **Partial matches** — You do not need to type the full title. A few characters are usually enough to narrow down results.
- **Chinese input** — The full-text search supports Chinese substring matching, so type any portion of the Chinese text you are looking for.
- **Keyboard-only workflow** — Use `Ctrl+K` + type + arrow keys + `Enter` to find and open any note without touching the mouse.
