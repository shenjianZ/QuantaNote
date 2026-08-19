---

## 📥 Download Links

QuantaNote __TAG__ assets are produced by the release workflow after version, signature, and platform checks pass. The workflow publishes the Draft Release automatically; users should select the asset matching their platform and architecture.

| Platform | Architecture | File | Size |
|----------|--------------|------|------|
| **Windows** | x64 | [QuantaNote-__TAG__-windows-x64.exe](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-windows-x64.exe) | ~10 MB |
| **Windows** | x64 | [QuantaNote-__TAG__-windows-x64.msi](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-windows-x64.msi) | ~12 MB |
| **macOS** | Apple Silicon (M1/M2/M3/M4) | [QuantaNote-__TAG__-macos-aarch64.dmg](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-macos-aarch64.dmg) | ~15 MB |
| **macOS** | Intel | [QuantaNote-__TAG__-macos-x64.dmg](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-macos-x64.dmg) | ~15 MB |
| **Linux** | x64 | [QuantaNote-__TAG__-linux-x64.AppImage](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-linux-x64.AppImage) | ~85 MB |
| **Linux** | x64 | [QuantaNote-__TAG__-linux-x64.deb](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-linux-x64.deb) | ~14 MB |
| **Linux** | x64 | [QuantaNote-__TAG__-linux-x64.rpm](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-linux-x64.rpm) | ~14 MB |
| **Android** | ARM64 | [QuantaNote-__TAG__-android-arm64-v8a.apk](https://github.com/shenjianZ/QuantaNote/releases/latest/download/QuantaNote-__TAG__-android-arm64-v8a.apk) | ~20 MB |

---

## 🍎 macOS 安装指南

### 问题 1：提示"已损坏"或"无法打开"

由于 QuantaNote 未签名，macOS Gatekeeper 会阻止运行。请在终端执行：

```bash
xattr -dr com.apple.quarantine /Applications/QuantaNote.app
```

### 问题 2："无法验证开发者" 警告

**方法 A：系统设置**
1. 打开 **系统设置** → **隐私与安全性** → **安全性**
2. 找到 QuantaNote 相关的阻止信息
3. 点击 **"仍要打开"** 按钮

**方法 B：右键打开**
1. 在 Finder 中右键点击 QuantaNote.app
2. 选择 **"打开"**
3. 在弹窗中点击 **"打开"**

### 问题 3：Homebrew 安装

QuantaNote 暂未发布 Homebrew Cask。请先从上方下载 `.dmg` 安装包。

---

## 🪟 Windows 安装指南

### 问题 1：Windows Defender SmartScreen 警告

首次运行时，Windows SmartScreen 可能会显示"Windows 已保护你的电脑"警告：

1. 点击 **"更多信息"**
2. 点击 **"仍要运行"**

### 问题 2：静默安装（高级用户/批量部署）

```powershell
QuantaNote-__TAG__-windows-x64.exe /S
```

---

## 🐧 Linux 安装指南

### AppImage 使用方法

```bash
# 1. 添加执行权限
chmod +x QuantaNote-__TAG__-linux-x64.AppImage

# 2. 运行
./QuantaNote-__TAG__-linux-x64.AppImage
```

### Debian/Ubuntu (.deb)

```bash
sudo dpkg -i QuantaNote-__TAG__-linux-x64.deb

# 如果遇到依赖问题
sudo apt-get install -f
```

### Fedora/RHEL (.rpm)

```bash
sudo rpm -i QuantaNote-__TAG__-linux-x64.rpm

# 或使用 dnf 自动处理依赖
sudo dnf localinstall QuantaNote-__TAG__-linux-x64.rpm
```

### Archive (.tar.gz)

```bash
tar -xzf QuantaNote-__TAG__-linux-x64.tar.gz
cd QuantaNote
./quanta-note
```

---

## 🤖 Android 安装指南

### 方法 1：直接安装 APK（推荐）

1. 下载 `QuantaNote-__TAG__-android-arm64-v8a.apk`
2. 在手机上打开下载的 APK 文件
3. 如果提示"未知来源"，请在设置中允许安装未知来源应用
4. 按照安装向导完成安装

### 方法 2：通过 ADB 安装

```bash
adb install QuantaNote-__TAG__-android-arm64-v8a.apk
```

### 注意事项

- **系统要求**：Android 7.0（API 24）及以上
- **首次安装**：Android 可能会要求授予文件访问权限，请允许以确保笔记数据正常存储
- **签名变更**：如果之前安装了不同签名的版本，需要先卸载旧版本

Android release assets are ARM64-only. Existing installations must keep using the same signing key for in-place upgrades.

## 🔄 Automatic Updates

Desktop packages use the signed `latest.json` manifest. If signature verification fails, download the matching package from the official Release instead of deleting the local data directory.

---

## 🔗 Resources

- 📖 [Documentation](https://quantanote-docs.shenjianl.cn)
- 🐛 [Report Issues](https://github.com/shenjianZ/QuantaNote/issues)
- 💬 [Discussions](https://github.com/shenjianZ/QuantaNote/discussions)
