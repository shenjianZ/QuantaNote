---
title: Installing QuantaNote
description: Download and install QuantaNote v0.4.0 on Windows, macOS, Linux, and Android
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# Installing QuantaNote

QuantaNote v0.4.0 provides desktop packages for Windows, macOS, and Linux, plus an ARM64 Android APK. All release assets are published on [GitHub Releases](https://github.com/shenjianZ/QuantaNote/releases).

## System Requirements

| Platform | Minimum version | Architecture |
|----------|-----------------|--------------|
| Windows | Windows 10 1803+ | x64 |
| macOS | macOS 10.15+ | Intel / Apple Silicon |
| Linux | Ubuntu 20.04, Fedora 36, or another major distribution | x64 |
| Android | Android 7.0 / API 24+ | ARM64 |

Windows and macOS packages are typically about 20–40 MB; the Linux AppImage is larger. The data directory grows as notes, attachments, and version history accumulate.

## Download Assets

Choose the asset matching your platform and architecture:

| Platform | Recommended file |
|----------|------------------|
| Windows | `QuantaNote-v0.4.0-windows-x64.msi` |
| Windows portable | `QuantaNote-v0.4.0-windows-x64.exe` |
| macOS Apple Silicon | `QuantaNote-v0.4.0-macos-aarch64.dmg` |
| macOS Intel | `QuantaNote-v0.4.0-macos-x64.dmg` |
| Universal Linux | `QuantaNote-v0.4.0-linux-x64.AppImage` |
| Ubuntu/Debian | `QuantaNote-v0.4.0-linux-x64.deb` |
| Fedora/RHEL | `QuantaNote-v0.4.0-linux-x64.rpm` |
| Android | `QuantaNote-v0.4.0-android-arm64-v8a.apk` |

The `.sig` files next to desktop packages and `latest.json` are used for updater signature verification and do not need to be opened manually.

## Windows

1. Download the `.msi` or `.exe` package.
2. Double-click the installer and follow the wizard.
3. If Windows SmartScreen appears, confirm that the file came from the official Release and choose **More info** → **Run anyway**.
4. Launch QuantaNote from the Start menu or desktop shortcut.

The `.exe` can also be used as a portable build. The packaged Windows application uses the native clipboard path first, so copied text can appear in Clipboard History with `Win + V` when it is enabled.

## macOS

1. Download `macos-aarch64` for Apple Silicon or `macos-x64` for Intel.
2. Open the `.dmg` and drag QuantaNote to **Applications**.
3. If macOS says the developer cannot be verified, open **System Settings** → **Privacy & Security** → **Open Anyway**.

Current macOS packages may not be notarized by Apple, so the first launch may require manual approval. The Apple Silicon build does not require Rosetta translation.

## Linux

### AppImage

```bash
chmod +x QuantaNote-v0.4.0-linux-x64.AppImage
./QuantaNote-v0.4.0-linux-x64.AppImage
```

### Debian/Ubuntu

```bash
sudo dpkg -i QuantaNote-v0.4.0-linux-x64.deb
sudo apt-get install -f
```

### Fedora/RHEL

```bash
sudo dnf install ./QuantaNote-v0.4.0-linux-x64.rpm
```

If the application does not start, check that WebKit, GTK, and system-tray runtime libraries are installed for your distribution.

## Android

1. Download `QuantaNote-v0.4.0-android-arm64-v8a.apk`.
2. Allow the file manager to install apps from this source when Android asks.
3. Open the APK and complete the installation.

You can also install it with ADB:

```bash
adb install QuantaNote-v0.4.0-android-arm64-v8a.apk
```

The Android release provides an ARM64 APK. Allow the permissions needed for the app's data directory. If a test build with a different signing key is installed, uninstall it only after exporting or backing up your data.

## First Launch and Data Directory

The first launch creates the local data directory and SQLite database automatically:

- Windows: `C:\Users\<username>\.quantanote\`
- macOS: `~/.quantanote/`
- Linux: `~/.quantanote/`
- Android: an application-sandboxed data directory

Uninstalling normally does not remove local data. Export or back up your data before deleting the data directory.

## Automatic Updates

Desktop builds check `latest.json` in GitHub Releases. An update package must pass signature verification before it can be installed. If an update fails, keep the current data directory and download the matching architecture manually from the official Release. See [Troubleshooting](./troubleshooting).

## Uninstalling

- Windows: Settings → Apps → QuantaNote → Uninstall.
- macOS: Drag the application to the Trash.
- Linux: Use the distribution package manager; delete an AppImage directly.
- Android: Uninstall from the system app settings.

Uninstalling does not automatically delete data. Back up first, then remove the platform data directory if a complete cleanup is required.
