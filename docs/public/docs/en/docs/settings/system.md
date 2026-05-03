---
title: System Integration
description: QuantaNote system integration settings including window behavior (minimize to tray, close keeps running), autostart, and system tray functionality
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# System Integration

System integration settings control how QuantaNote interacts with the operating system, including window behavior, autostart, and system tray features. These settings help you seamlessly incorporate QuantaNote into your daily workflow.

## Window Behavior

Window behavior settings determine how QuantaNote responds when you close or minimize the window. With proper configuration, the application can continue running in the background and be quickly brought back at any time.

### Minimize to Tray

When enabled, clicking the minimize button hides the window to the system tray area instead of minimizing it to the taskbar.

| Option | Description |
|--------|-------------|
| **On** | Clicking minimize hides the window to the system tray, freeing taskbar space |
| **Off** (default) | Clicking minimize normally minimizes the window to the taskbar |

**Use cases:**

- Using QuantaNote for extended note-taking and wanting quick access via the tray icon
- Limited screen space; too many taskbar icons are undesirable
- Combined with "Close keeps running" for full tray-based operation

### Close Keeps Running

When enabled, clicking the close button hides the window to the system tray instead of exiting the application.

| Option | Description |
|--------|-------------|
| **On** | Clicking close hides the window to the tray; the application continues running in the background |
| **Off** (default) | Clicking close exits the application normally |

**Use cases:**

- Frequently closing the window temporarily without losing application state
- Keeping QuantaNote always available in the background, ready to reopen via the tray icon
- Ensuring auto-backup continues running in the background at all times

> **Note**: When this option is enabled, you must use the "Quit" option in the system tray context menu to fully exit the application.

## Autostart

When autostart is enabled, QuantaNote launches automatically when the operating system starts.

| Option | Description |
|--------|-------------|
| **On** | QuantaNote starts automatically when the system boots |
| **Off** (default) | QuantaNote must be started manually |

### Technical Implementation

Autostart is implemented via Tauri's `setAutostart` command, which leverages the operating system's native autostart mechanism:

- **Windows**: Registry entry or Startup folder
- **macOS**: LaunchAgent configuration
- **Linux**: `.desktop` file autostart configuration

### Recommended Configuration

For the best experience, we recommend enabling the following settings together:

1. Enable **Autostart**
2. Enable **Close keeps running**
3. Enable **Minimize to tray**

This combination ensures QuantaNote starts automatically in the background when the system boots, can be quickly opened via the tray icon when needed, and stays out of the way when not in use.

## System Tray

QuantaNote supports system tray functionality. When the application is minimized or hidden to the tray, the tray icon provides the following features:

### Tray Icon

- The QuantaNote icon appears in the system tray area
- Single-clicking the tray icon restores the main application window
- The icon state reflects the current application status

### Context Menu

Right-clicking the tray icon opens a context menu with the following options:

| Menu Item | Function |
|-----------|----------|
| **Show Window** | Restores the hidden application window to the foreground |
| **New Note** | Quickly opens the Workspace to create a new note |
| **Quit** | Fully exits the QuantaNote application |

> **Tip**: If you frequently need to capture quick notes, set QuantaNote to autostart and minimize to tray. Use the tray right-click menu's "New Note" option for instant note capture.
