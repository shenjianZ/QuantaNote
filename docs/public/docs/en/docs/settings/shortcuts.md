---
title: Keyboard Shortcuts
description: QuantaNote's supported shortcuts, command palette actions, and customization options
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-30
---

# Keyboard Shortcuts

QuantaNote uses `Mod` for the primary modifier on the current platform: `Ctrl` on Windows/Linux and `Command (⌘)` on macOS. Open Settings → Shortcuts to view, record, clear, or reset bindings.

## Application Shortcuts

QuantaNote handles the shortcuts below. They do not take over text entry while an input, textarea, or editor body has focus.

| Default | Action | Scope |
|---|---|---|
| `Mod + K` | Open/close the Command Palette | Global (not inside the editor body) |
| `Mod + N` | Create a new note | Global (not in editable areas) |
| `Mod + ,` | Open Settings | Global (not in editable areas) |
| `Mod + Enter` | Save workspace content | Workspace |
| `Mod + S` | Save the current note | Document Editor |
| `Mod + F` | Find | Document Editor |
| `Mod + H` | Find and replace | Document Editor |

## Command Palette

Press `Mod + K` to open the Command Palette. It combines note search with commands available on the current page:

- Create a note and open Settings.
- In the Document Editor, save the note, insert an image, manage attachments, and open version history.
- In the Document Editor or Library, copy the current note.
- Type to filter, use the arrow keys and `Enter` to choose, or press `Esc` to close.

## Editor Shortcuts

The Document Editor uses Vditor for common editing operations. QuantaNote owns save and find/replace:

| Shortcut | Action |
|---|---|
| `Mod + S` | Immediately save the title, summary, and body; auto-save remains enabled |
| `Mod + F` | Open the find bar |
| `Mod + H` | Open the find-and-replace bar |
| `Mod + B` | Bold |
| `Mod + I` | Italic |
| `Mod + D` | Strikethrough |
| `Mod + Z` | Undo |
| `Mod + Shift + Z` | Redo |
| `Mod + A` | Select all |
| `Mod + C` / `Mod + X` / `Mod + V` | Copy / cut / paste |
| `Tab` / `Shift + Tab` | Indent / outdent a list |

In the find bar, `Enter` moves to the next match, `Shift + Enter` to the previous match, and `Esc` closes it. `Mod + K`, `Mod + N`, and `Mod + ,` remain text-editing-safe inside the editor body and do not open global actions there.

## Customization and Conflict Detection

1. Open Settings → Shortcuts.
2. Click a shortcut button and press a combination that includes a modifier.
3. If two commands use the same combination, the conflicting command names appear immediately.
4. Use Clear to disable one application shortcut, or Reset defaults to restore all defaults.

Vditor editing shortcuts are not registered again as application commands, preventing a global customization from overriding text editing. A bare letter or arrow key is not saved as an application shortcut.
