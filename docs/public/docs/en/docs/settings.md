---
title: Settings
description: QuantaNote Settings section overview, covering appearance, fonts, system integration, diagnostics, and keyboard shortcuts configuration
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Settings

QuantaNote offers a wide range of personalization options that let you tailor the application to your workflow and preferences. The Settings page is organized into multiple sections accessible via the left sidebar menu.

## Settings Sections

| Section | Description |
|---------|-------------|
| [Appearance](./appearance) | Configure theme mode (light/dark/system), accent colors (12 presets + custom), and interface language |
| [Fonts](./fonts) | Choose UI font, monospace font, adjust font size (14-18px), and preview changes in real time |
| [System Integration](./system) | Window behavior (minimize to tray, close keeps running), autostart, and system tray options |
| [Diagnostics](./diagnostics) | SQL logging configuration, log file management, database info, and VACUUM optimization |
| [Keyboard Shortcuts](./shortcuts) | Reference for global, workspace, editor, and navigation keyboard shortcuts |

## How to Access Settings

1. Click the **Settings** icon on the right side of the top navigation bar
2. Select the settings category you want to adjust from the left sidebar
3. All changes take effect **immediately** and are saved automatically

## Settings Storage

All settings are stored locally in the SQLite database at `~/.quantanote/quanta_note.sqlite`. Setting changes are synchronized in real time between the frontend and the Rust backend.

- **Frontend**: Managed by the `settingsStore` Zustand store
- **Backend**: Read and written via `loadAllSettings` and `saveSettings` commands
- **Persistence**: Settings are stored as JSON under the `quantanote-settings` key in the database

## Resetting to Defaults

To restore all settings to their initial state:

1. Close QuantaNote
2. If you need a settings rollback copy the SQLite main database after closing the app (optional; use the logical ZIP backup in Data Management for routine backups)
3. Delete the `quantanote-settings` entry from the database
4. Restart the application; it will automatically load default settings

> **Tip**: You can adjust any setting at any time. All changes are instant and reversible.
