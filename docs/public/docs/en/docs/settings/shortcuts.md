---
title: Keyboard Shortcuts
description: QuantaNote keyboard shortcuts reference covering global shortcuts, workspace shortcuts, editor shortcuts, and navigation shortcuts
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Keyboard Shortcuts

QuantaNote provides comprehensive keyboard shortcut support for efficient keyboard-centric operation. Mastering these shortcuts can significantly boost your productivity by reducing mouse usage.

## Global Shortcuts

Global shortcuts are available from any page in the application.

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl + K` | Command Palette | Opens the global search panel to search for and jump to any record by keyword |
| `Ctrl + ,` | Open Settings | Jumps directly to the Settings page |

### Command Palette

`Ctrl + K` is one of the most important shortcuts in QuantaNote. The command palette supports:

- Real-time keyword search across all records
- Instant display of search results; click to jump to any match
- Full-text search across titles and content
- Press `Esc` to close the command palette

## Workspace Shortcuts

The Workspace page is designed for quick note capture. The following shortcuts accelerate the recording workflow.

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl + Enter` | Quick Save | Saves the current input as a new record and clears the editor |
| `Tab` | Indent | Inserts an indent in the editor |
| `Shift + Tab` | Outdent | Reduces the indent level |

### Quick Capture Workflow

The fastest note-taking workflow using keyboard shortcuts:

1. Open QuantaNote (or switch to it via the tray icon)
2. Start typing your content immediately
3. Press `Ctrl + Enter` to save
4. Continue typing the next note

## Editor Shortcuts

The Document Editor (Vditor) supports a rich set of editing shortcuts, including general editing and Markdown-specific shortcuts.

### General Editing Shortcuts

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Ctrl + S` | Save | Manually saves the current content (auto-save is also active) |
| `Ctrl + F` | Find | Opens the search bar to find text within the document |
| `Ctrl + H` | Replace | Opens the find-and-replace bar |
| `Ctrl + Z` | Undo | Undoes the last action |
| `Ctrl + Shift + Z` | Redo | Redoes a previously undone action |
| `Ctrl + A` | Select All | Selects all content in the editor |
| `Ctrl + C` | Copy | Copies selected text and displays the result |
| `Ctrl + X` | Cut | Cuts the selected text |
| `Ctrl + V` | Paste | Pastes clipboard content and displays the result |

### Find and Replace

The built-in find-and-replace feature supports the following actions:

| Action | Shortcut / Button | Description |
|--------|-------------------|-------------|
| Open Find | `Ctrl + F` | Opens the search bar at the bottom |
| Open Replace | `Ctrl + H` | Shows the replace input field in the search bar |
| Next Match | `Enter` | Jumps to the next match |
| Previous Match | `Shift + Enter` | Jumps to the previous match |
| Close Search | `Esc` | Closes the search/replace bar |

### Markdown Shortcuts

The editor supports Markdown syntax shortcuts for quick formatting:

| Input | Result |
|-------|--------|
| `#` + Space | Heading 1 |
| `##` + Space | Heading 2 |
| `###` + Space | Heading 3 |
| `**text**` | **Bold** |
| `*text*` | *Italic* |
| `` `code` `` | Inline code |
| `- ` + Space | Unordered list |
| `1.` + Space | Ordered list |
| `> ` + Space | Blockquote |
| `---` | Horizontal rule |
| `[text](url)` | Hyperlink |
| `![alt](url)` | Image |

## Navigation Shortcuts

The following shortcuts are used for navigating between pages.

| Shortcut | Function | Description |
|----------|----------|-------------|
| `Alt + Left` | Back | Navigate back to the previously visited page |
| `Alt + Right` | Forward | Navigate forward (available after using Back) |

### Page Switching

Use the top navigation bar icons to switch between main pages:

| Page | Entry Point | Description |
|------|-------------|-------------|
| Workspace | First icon in the top bar | Quick capture page |
| Library | Second icon in the top bar | Browse and manage all records |
| Settings | Gear icon in the top bar | Application settings |

> **Tip**: Using `Ctrl + K` to open the Command Palette is the fastest way to jump to other records without leaving the keyboard.

## Cross-Platform Notes

- Windows and Linux normally use `Ctrl`.
- macOS normally uses `Command (⌘)` instead of `Ctrl`.
- The packaged Windows desktop app can use Windows Clipboard History with `Win + V` after copying.
- macOS and Linux do not have a universal Windows Clipboard History panel, but copy and paste use the clipboard capabilities available on each platform.
- Copy success, copy failure, and paste success are reported with toasts so you can verify clipboard availability.
