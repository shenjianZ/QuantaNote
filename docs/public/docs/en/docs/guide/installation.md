---
title: Installing QuantaNote
description: Download and install QuantaNote on Windows, macOS, and Linux
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# Installing QuantaNote

## System Requirements

Before installing QuantaNote, make sure your device meets the following minimum requirements:

| Platform | Minimum Version | Architecture |
|----------|----------------|--------------|
| Windows | Windows 10 (1803+) | x64 |
| macOS | macOS 10.15 (Catalina)+ | x64 / Apple Silicon |
| Linux | Major distributions (Ubuntu 20.04+, Fedora 36+, etc.) | x64 |

> **Disk Space**: The installer is approximately 20-40 MB, and the installed application takes up about 80-120 MB. Disk usage will gradually increase as you accumulate data and attachments over time.

## Download and Install

All QuantaNote releases are published on the GitHub Releases page:

👉 [GitHub Releases Download Page](https://github.com/shenjianZ/QuantaNote/releases)

### Windows

1. Download the latest `.msi` installer (recommended) or `.exe` installer from the Releases page.
2. Double-click the downloaded installer to run it.
3. If Windows SmartScreen shows a security warning, click "More info" → "Run anyway".
4. Follow the installation wizard to complete the installation.
5. After installation, launch QuantaNote from the Start menu or desktop shortcut.

> **Portable Version**: For a no-install experience, download the `.exe` portable version. Extract and run it directly — no administrator privileges required.

### macOS

1. Download the latest `.dmg` file from the Releases page.
2. Double-click to open the `.dmg` file.
3. Drag the QuantaNote icon to the "Applications" folder.
4. On first launch, if macOS prompts "Cannot verify the developer", go to "System Settings" → "Privacy & Security" → click "Open Anyway".

> **Apple Silicon (M1/M2/M3/M4)**: QuantaNote natively supports Apple Silicon — no Rosetta translation needed.

### Linux

**DEB Package (Ubuntu / Debian):**

```bash
# Install after downloading the .deb package
sudo dpkg -i quantanote_x.x.x_amd64.deb

# If missing dependencies are reported, run:
sudo apt-get install -f
```

**AppImage (Universal):**

```bash
# Add execute permission after downloading the .AppImage file
chmod +x quantanote_x.x.x_amd64.AppImage

# Run
./quantanote_x.x.x_amd64.AppImage
```

## First Launch

When you launch QuantaNote for the first time, the application automatically performs the following initialization:

1. **Create Data Directory** — Creates the `~/.quantanote/` directory in your home folder:
   - Windows: `C:\Users\<YourUsername>\.quantanote\`
   - macOS: `/Users/<YourUsername>/.quantanote/`
   - Linux: `/home/<YourUsername>/.quantanote/`

2. **Initialize Database** — Automatically creates the `quanta_note.sqlite` database file and executes schema initialization to create all required tables and indexes:
   - `items` — Note items table
   - `tags` — Tags table
   - `item_tags` — Many-to-many association table between notes and tags
   - `attachments` — Attachments table
   - `versions` — Version history table
   - `items_fts` — FTS5 full-text search virtual table

3. **Configure Database Parameters** — Automatically sets SQLite's WAL journal mode and enables foreign key constraints to ensure data integrity and high performance.

Once initialization is complete, you will see QuantaNote's main interface and can start creating notes immediately.

## Uninstalling

If you need to uninstall QuantaNote, follow these steps:

### Windows

- Go to "Settings" → "Apps" → find QuantaNote → click "Uninstall"
- Or use "Programs and Features" in the Control Panel

### macOS

- Open the "Applications" folder and drag QuantaNote to the Trash
- Or long-press the icon in Launchpad and click the delete button

### Linux

```bash
# Uninstall DEB package installation
sudo dpkg --remove quantanote

# For AppImage, simply delete the file
rm quantanote_x.x.x_amd64.AppImage
```

> **Data Retention**: Uninstalling QuantaNote does **not** delete your data. All notes, tags, attachments, and settings are preserved in the `~/.quantanote/` directory. If you want to completely remove all data, manually delete that directory:
>
> ```bash
> # Caution: deletes all QuantaNote data
> rm -rf ~/.quantanote/
> ```
