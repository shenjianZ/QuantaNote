# QuantaNote v0.4.0 发布操作手册

## 发布目标

本次发布覆盖 Windows x64、macOS Intel/Apple Silicon、Linux x64、Android ARM64、桌面端自动更新和 QuantaNote Cloud 多架构镜像。

发布使用 `v0.4.0` Tag。Tag 推送后由 GitHub Actions 创建 Draft Release，所有桌面端、Android 和更新清单门禁通过后自动发布；云端镜像在客户端 Release 成功后再推广 `latest`。

## 发布前检查

```powershell
git status --short
git diff --check
pnpm install --frozen-lockfile
pnpm docs:check
pnpm check
pnpm test:unit
pnpm test:rust
pnpm format:rust:check
pnpm test:e2e:serial
pnpm docs:build
pnpm server:check
```

确认工作区没有签名私钥、keystore、`.env` 或 `updater.info` 等敏感文件。

## 版本号

版本号不带 `v`，Tag 带 `v`：

```powershell
pnpm bump 0.4.0
```

需要确认根 package、site/docs package、Tauri 配置、Cargo、云端 CLI/health、站点下载页和文档页脚全部为 `0.4.0`。

## GitHub Actions Secrets

桌面端：

| Secret | 用途 |
|--------|------|
| `QUANTANOTE_TAURI_UPDATER_PUBLIC_KEY` | 更新器公钥 |
| `QUANTANOTE_TAURI_SIGNING_PRIVATE_KEY` | 安装包签名私钥 |
| `QUANTANOTE_TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 签名密码 |

Android：

| Secret | 用途 |
|--------|------|
| `ANDROID_KEYSTORE_BASE64` | Base64 编码的 Android keystore |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码 |
| `ANDROID_KEY_ALIAS` | 签名别名 |
| `ANDROID_KEY_PASSWORD` | 签名密钥密码 |

云端镜像：

| Secret | 用途 |
|--------|------|
| `ALIYUN_REGISTRY` | ACR 地址 |
| `ALIYUN_NAME_SPACE` | ACR 命名空间 |
| `ALIYUN_REGISTRY_USER` | ACR 用户名 |
| `ALIYUN_REGISTRY_PASSWORD` | ACR 密码 |

任何必需 Secret 缺失都必须阻断发布。私钥只存在 GitHub Secrets，不提交到仓库。

## 提交和触发发布

```powershell
git push origin master
git tag -a v0.4.0 -m "Release v0.4.0"
git push origin v0.4.0
```

Tag 推送后执行顺序：

1. Release 工作流创建 Draft Release。
2. Windows、Linux、macOS Intel、macOS Apple Silicon 并行构建。
3. Android 构建 ARM64 APK。
4. 合并并校验 `latest.json`。
5. 校验所有安装包、签名、版本和下载链接。
6. 自动发布 GitHub Release。
7. 构建云端镜像版本标签并推广 `latest`。

## 预期 Release 资产

```text
QuantaNote-v0.4.0-windows-x64.exe
QuantaNote-v0.4.0-windows-x64.msi
QuantaNote-v0.4.0-macos-aarch64.dmg
QuantaNote-v0.4.0-macos-x64.dmg
QuantaNote-v0.4.0-linux-x64.AppImage
QuantaNote-v0.4.0-linux-x64.deb
QuantaNote-v0.4.0-linux-x64.rpm
QuantaNote-v0.4.0-android-arm64-v8a.apk
latest.json
```

桌面端更新清单必须包含 `windows-x86_64`、`darwin-aarch64`、`darwin-x86_64` 和 `linux-x86_64`，每个平台都要有签名和 URL。

## 发布后验收

- GitHub Release 为非 Draft 状态。
- 所有资产可下载，`latest.json` 可访问。
- Windows、macOS、Linux 和 Android 至少各完成一次安装启动验证。
- 从 `v0.3.0` 升级到 `v0.4.0` 后数据、附件和版本历史保持不变。
- 自动更新签名校验和下载成功。
- 云端镜像存在 `v0.4.0` 多架构标签和 `latest` 标签。
- 文档站和产品站显示 `v0.4.0`。

## 失败和回滚

- 构建失败但 Release 尚未公开时，修复后重新运行工作流，不覆盖已发布 Tag。
- 已公开版本出现严重问题时发布 `v0.4.1`，不移动 `v0.4.0`。
- 云镜像保留不可变版本标签，只在确认后回退 `latest`。
- Android 不得更换已有签名密钥，否则用户无法覆盖升级。
