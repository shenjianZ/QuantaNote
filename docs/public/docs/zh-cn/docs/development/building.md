---
title: 从源码构建
description: 了解如何搭建 QuantaNote 本地开发环境，克隆代码仓库并从源码构建项目
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-08-19
---

# 从源码构建

本文将指导你从源码构建 QuantaNote。在开始之前，请确保你的系统满足所有前置条件。

## 前置条件

在构建 QuantaNote 之前，你需要安装以下工具：

- **Node.js 20.19+（CI 使用 Node.js 22）** — 前端运行时和包管理基础
  ```bash
  # 推荐使用 nvm 管理Node.js版本
  nvm install 22
  nvm use 22
  node --version  # 确认版本 >= 20.19
  ```

- **pnpm 10.33.2** — 包管理器（QuantaNote 仅支持 pnpm）
  ```bash
  corepack enable
  corepack prepare pnpm@10.33.2 --activate
  pnpm --version  # 确认版本为 10.33.2
  ```

- **Rust 工具链** — 后端编译所需
  ```bash
  # 通过 rustup 安装 Rust
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  rustc --version  # 确认安装成功
  cargo --version
  ```

- **Tauri 2.0 依赖** — 根据你的操作系统安装对应依赖：
  - **Windows**: Visual Studio C++ Build Tools、WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev`、`libgtk-3-dev` 等
  - **macOS**: Xcode Command Line Tools

## 克隆与安装

```bash
# 克隆仓库
git clone https://github.com/shenjianZ/QuantaNote.git
cd QuantaNote

# 安装前端依赖
pnpm install
```

安装完成后，依赖将被锁定在 `pnpm-lock.yaml` 中，确保团队成员使用一致的依赖版本。

## 开发模式

开发模式会同时启动前端 Vite 开发服务器（端口 1420）和 Rust 后端：

```bash
# 启动 Tauri 开发模式
pnpm tauri dev
```

此命令会：

1. 启动 Vite 开发服务器，支持前端热更新
2. 编译 Rust 后端并启动 Tauri 窗口
3. 修改前端代码后会自动热更新
4. 修改 Rust 代码后会自动重新编译

如果你只需要开发前端（不涉及 Rust 修改），可以单独启动前端：

```bash
pnpm dev
```

## 生产构建

```bash
# 构建生产版本
pnpm tauri build
```

发布构建还会由 GitHub Actions 在 Windows、macOS Intel/Apple Silicon、Linux 和 Android ARM64 环境中执行。正式发布需要使用签名 Secrets，不能使用本地私钥文件代替 CI Secrets。

此命令会：

1. 执行 TypeScript 类型检查
2. 使用 Vite 打包前端资源
3. 编译 Rust 后端（Release 模式）
4. 生成平台特定的安装包

如果只需要检查前端构建是否通过：

```bash
pnpm build
```

如果只需要检查 Rust 编译是否通过：

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## 构建产物

生产构建完成后，安装包位于 `src-tauri/target/release/bundle/` 目录下：

| 平台 | 构建产物 |
|------|----------|
| **Windows** | `.msi` 安装包、`.exe` 可执行文件 |
| **Linux** | `.deb` Debian 包、`.AppImage` 便携包 |
| **macOS** | `.dmg` 磁盘映像、`.app` 应用包 |
| **Android** | ARM64 `.apk` |

构建产物路径示例：

```
src-tauri/target/release/
├── quantanote.exe          # Windows 可执行文件
└── bundle/
    ├── msi/                # Windows MSI 安装包
    │   └── QuantaNote_0.1.0_x64_en-US.msi
    └── nsis/               # Windows NSIS 安装包
        └── QuantaNote_0.1.0_x64-setup.exe
```

## 常见问题

### Rust 编译失败

确保 Rust 工具链是最新的：

```bash
rustup update stable
```

### 前端依赖安装失败

尝试清除缓存后重新安装：

```bash
pnpm store prune
rm -rf node_modules
pnpm install
```

### WebView2 缺失（Windows）

在 Windows 上，Tauri 依赖 WebView2 运行时。大多数 Windows 11 系统已预装。如缺少，请从 [Microsoft 官网](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载安装。
