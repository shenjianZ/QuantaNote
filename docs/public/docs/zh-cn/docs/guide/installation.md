---
title: 安装 QuantaNote
description: QuantaNote v0.4.0 下载与安装指南，支持 Windows、macOS、Linux 和 Android
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# 安装 QuantaNote

QuantaNote v0.4.0 提供 Windows、macOS、Linux 桌面安装包和 Android ARM64 APK。所有正式产物均发布在 [GitHub Releases](https://github.com/shenjianZ/QuantaNote/releases)。

## 系统要求

| 平台 | 最低版本 | 架构 |
|------|----------|------|
| Windows | Windows 10 1803+ | x64 |
| macOS | macOS 10.15+ | Intel / Apple Silicon |
| Linux | Ubuntu 20.04、Fedora 36 等主流发行版 | x64 |
| Android | Android 7.0 / API 24+ | ARM64 |

Windows 和 macOS 安装包通常需要约 20–40 MB；Linux AppImage 会更大。实际数据目录还会随着笔记、附件和版本历史增加。

## 下载文件

在 Release 页面选择与你的平台和架构对应的文件：

| 平台 | 推荐文件 |
|------|----------|
| Windows | `QuantaNote-v0.4.0-windows-x64.msi` |
| Windows 便携版 | `QuantaNote-v0.4.0-windows-x64.exe` |
| macOS Apple Silicon | `QuantaNote-v0.4.0-macos-aarch64.dmg` |
| macOS Intel | `QuantaNote-v0.4.0-macos-x64.dmg` |
| Linux 通用包 | `QuantaNote-v0.4.0-linux-x64.AppImage` |
| Ubuntu/Debian | `QuantaNote-v0.4.0-linux-x64.deb` |
| Fedora/RHEL | `QuantaNote-v0.4.0-linux-x64.rpm` |
| Android | `QuantaNote-v0.4.0-android-arm64-v8a.apk` |

安装包旁边的 `.sig` 文件和 `latest.json` 用于自动更新签名校验，不需要手动打开。

## Windows

1. 下载 `.msi` 或 `.exe`。
2. 双击安装包并按照向导完成安装。
3. 如果 Windows SmartScreen 提示风险，确认文件来自官方 Release 后点击“更多信息”→“仍要运行”。
4. 从开始菜单或桌面快捷方式启动 QuantaNote。

`.exe` 可作为便携版本直接运行。Windows 正式桌面应用会优先使用原生剪贴板，因此开启剪贴板历史记录后可用 `Win + V` 查看复制内容。

## macOS

1. Apple Silicon 设备下载 `macos-aarch64`，Intel 设备下载 `macos-x64`。
2. 打开 `.dmg` 并将 QuantaNote 拖入“应用程序”。
3. 首次启动若提示无法验证开发者，打开“系统设置”→“隐私与安全性”→“仍要打开”。

当前 macOS 产物可能未经过 Apple 公证，因此首次启动需要手动允许。Apple Silicon 版本不需要 Rosetta 转译。

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

如果启动失败，请检查发行版是否安装了 WebKit、GTK 和系统托盘相关运行库。

## Android

1. 下载 `QuantaNote-v0.4.0-android-arm64-v8a.apk`。
2. 在 Android 设备上允许安装来自当前文件管理器的未知来源应用。
3. 打开 APK 并完成安装。

也可以通过 ADB 安装：

```bash
adb install QuantaNote-v0.4.0-android-arm64-v8a.apk
```

Android 版本只提供 ARM64 APK。首次使用时，请允许应用访问其数据目录所需的权限。如果设备已安装不同签名的测试版本，可能需要先卸载测试版本；卸载前请先导出或备份数据。

## 首次启动和数据目录

首次启动会自动创建本地数据目录和 SQLite 数据库：

- Windows：`C:\Users\<用户名>\.quantanote\`
- macOS：`~/.quantanote/`
- Linux：`~/.quantanote/`
- Android：由应用沙盒管理的数据目录

卸载应用通常不会删除本地数据。删除数据目录前请先使用导出或备份功能。

## 自动更新

桌面端会从 GitHub Release 检查 `latest.json`。更新包必须通过签名校验后才会安装。若自动更新失败，请保留当前数据目录并从官方 Release 手动下载对应架构的安装包，详见[故障排查](./troubleshooting)。

## 卸载

- Windows：系统设置→应用→QuantaNote→卸载。
- macOS：将应用拖入废纸篓。
- Linux：使用发行版的包管理器卸载，AppImage 直接删除文件。
- Android：在系统应用设置中卸载。

卸载不会自动删除数据。如需彻底清理，请先备份，再手动删除对应数据目录。
