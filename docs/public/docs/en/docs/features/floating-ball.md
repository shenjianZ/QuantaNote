---
title: Floating Ball
description: QuantaNote floating ball guide covering global quick actions, quick notes, dragging, position persistence, and settings
author: QuantaNote Team
createdAt: 2026-05-12
lastUpdated: 2026-05-12
---

# Floating Ball

The floating ball is a desktop quick-access entry point for QuantaNote. When enabled, it appears as a small transparent window above other windows so you can create notes, open search, or jump back to recent items without switching back to the main window first.

## Enabling It

Open **Settings → Appearance → Window Behavior** and enable **Floating Ball**. QuantaNote will create a separate floating window.

| Setting | Description |
|---------|-------------|
| Floating Ball | Shows or closes the floating ball window |
| Floating Ball Position | Optional physical screen X/Y coordinates; when empty, the ball appears near the bottom-right of the primary screen |
| Reset | Clears manual coordinates and lets the app calculate the default position again |

The floating ball position is persisted. When you drag the ball, QuantaNote saves the new screen coordinates and reuses them the next time the feature is enabled or the app starts.

## Quick Action Menu

Click the floating ball to open the radial menu. It currently provides these actions:

| Action | Description |
|--------|-------------|
| Quick Note | Opens a standalone quick note window for temporary capture |
| Search | Opens the command palette to search notes |
| Recent Notes | Switches to the library so you can review recent content |
| New Full Note | Creates a new item in the main window and enters the normal editing flow |
| Close Floating Ball | Closes the floating ball and updates the setting |

When the menu is open, the floating window temporarily expands to fit the menu. When closed, it returns to the compact ball size.

## Quick Note Window

The quick note window is a lightweight standalone editor for capturing content while staying in your current workflow.

- Write with the Markdown editor.
- Click the save button or press `Ctrl + Enter` to save.
- On macOS, use `⌘ + Enter` to save.
- Press `Esc` to close the quick note window.
- Saved content is written to the library as a normal item, with the title derived automatically.

If saving fails, QuantaNote shows an error message and does not intentionally clear the editor content.

## Dragging and Multi-Monitor Behavior

You can drag the floating ball while it is collapsed. The app calculates the default position from the available monitor work area and keeps the ball inside a visible work area when possible.

When entering coordinates manually, use physical screen coordinates from the operating system. If the ball becomes hard to reach or appears on the wrong screen, use **Reset** to return to automatic placement.

## Recommended Use

- Enable the floating ball if you often need temporary capture while working in other apps.
- Combine it with **Close keeps running** and **Minimize to tray** if you want QuantaNote to stay available in the background.
- After changing monitor layouts, use **Reset** if the saved position no longer feels right.
