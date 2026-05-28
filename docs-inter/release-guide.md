# QuantaNote Release 操作手册

## 发布流程

1. 更新 `CHANGELOG.md`，添加新版本内容
2. 提交代码：`git commit -m "docs: update changelog for v0.2.0"`
3. 推送：`git push origin master`
4. 打 Tag：`git tag -a v0.2.0 -m "Release v0.2.0"`
5. 推送 Tag：`git push origin v0.2.0`（触发 CI）
6. 等待 CI 构建完成（Windows/Linux/macOS x4 + Android x1）
7. 在 GitHub Releases 检查 Draft Release，确认包含以下文件：
   - 桌面端：`.exe`, `.msi`, `.dmg`, `.AppImage`, `.deb`, `.rpm`
   - Android：`.apk`
   - 更新清单：`latest.json`
8. 点击 Publish

## CHANGELOG.md 格式

```markdown
## [0.2.0] - 2026-05-15

### Added
- 新增功能描述

### Fixed
- 修复问题描述

### Changed
- 变更描述
```

**注意**：版本号不带 `v` 前缀，Tag 带 `v` 前缀。

## CI 工作原理

- 触发条件：推送 `v*` Tag
- Job 1：从 CHANGELOG.md 提取对应版本内容，创建 Draft Release
- Job 2：并行构建 4 个平台产物

### CHANGELOG 提取规则

```bash
sed -n "/^## \[${TAG#v}\]/,/^## \[/p" CHANGELOG.md
```

匹配 `## [版本号]` 到下一个 `## [` 之间的内容。

## 构建产物

| 平台 | 产物 |
|------|------|
| Windows | `.msi` + `.exe` |
| Linux | `.deb` + `.AppImage` |
| macOS ARM | `.dmg` + `.app` |
| macOS x64 | `.dmg` + `.app` |
| Android | `.apk` (ARM64) |

## 常见问题

**Tag 推送后未触发 CI**：检查 Tag 格式是否为 `v*`

**CHANGELOG 未提取**：检查格式是否为 `## [版本号] - 日期`

**重新发布**：删除 Tag → 删除 Draft Release → 重新打 Tag 推送

## Android 构建配置

### 所需 GitHub Secrets

| Secret | 说明 |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | Base64 编码的签名 keystore 文件 |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore 密码 |
| `ANDROID_KEY_ALIAS` | 签名密钥别名 |
| `ANDROID_KEY_PASSWORD` | 签名密钥密码 |

### 首次准备：生成 Keystore 并配置 Secrets

#### 第一步：生成 Keystore

需要 JDK 环境中的 `keytool` 命令（安装 Android Studio 或 JDK 后自带）。

```powershell
# Windows PowerShell — 在项目根目录执行
keytool -genkey -v `
  -keystore release.keystore `
  -alias quantanote `
  -keyalg RSA -keysize 2048 `
  -validity 10000 `
  -storetype PKCS12 `
  -dname "CN=QuantaNote, OU=Dev, O=QuantaNote, L=Unknown, ST=Unknown, C=CN"
```

执行后输入：
- **keystore 密码**：自定义，妥善保存
- **密钥密码**：直接回车（与 keystore 密码相同），或设置独立密码

生成 `release.keystore` 文件。**此文件为签名私钥，切勿提交到 Git，请妥善备份。**

#### 第二步：Base64 编码

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\release.keystore"))
```

复制输出的长字符串。

#### 第三步：配置 GitHub Secrets

打开仓库 **Settings → Secrets and variables → Actions → New repository secret**，添加：

| Secret 名称 | 填入内容 |
|-------------|---------|
| `ANDROID_KEYSTORE_BASE64` | 上一步 Base64 编码输出的字符串 |
| `ANDROID_KEYSTORE_PASSWORD` | 第一步中设置的 keystore 密码 |
| `ANDROID_KEY_ALIAS` | `quantanote`（即 `-alias` 参数值） |
| `ANDROID_KEY_PASSWORD` | 密钥密码（如果设置了独立密码则填独立密码，否则与 keystore 密码相同） |

#### 第四步：验证

手动触发一次 Android 构建（**Actions → Build Android → Run workflow**），检查是否成功生成签名 APK。

> **CI 签名原理**：工作流自动将 keystore 解码到临时目录并生成 `keystore.properties`，Gradle `signingConfigs.release` 读取该文件完成签名，无需命令行传参。

### Android 构建产物

| 文件 | 说明 |
|------|------|
| `QuantaNote-vX.Y.Z-android-arm64-v8a.apk` | ARM64 签名 APK，支持绝大部分 Android 设备 |

### Android 常见问题

**NDK 未找到**：检查 `sdkmanager "ndk;27.0.12077973"` 是否安装成功，确认 `ANDROID_NDK_HOME` 环境变量

签名通过 `keystore.properties` 文件配置（CI 自动生成），Gradle `signingConfigs.release` 读取该文件完成签名。无需在命令行传递签名参数。

**APK 未生成**：检查 `tauri android init` 是否成功，查看 Gradle 构建日志中的错误信息
