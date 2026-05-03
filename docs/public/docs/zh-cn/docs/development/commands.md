---
title: 开发命令
description: QuantaNote 常用开发命令速查表
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# 开发命令

本文列出了 QuantaNote 开发过程中的常用命令。所有命令均使用 pnpm 作为包管理器，在项目根目录下执行。

## 前端开发

### 启动开发服务器

```bash
pnpm dev
```

启动 Vite 开发服务器，默认端口为 **1420**。仅包含前端部分，适用于纯前端开发（不涉及 Rust 修改）。支持热模块替换（HMR），修改代码后浏览器会自动更新。

### 前端构建

```bash
pnpm build
```

执行 TypeScript 类型检查并使用 Vite 打包前端资源。构建产物输出到 `dist/` 目录。此命令可用于验证前端代码是否存在类型错误或构建问题。

### 预览构建产物

```bash
pnpm preview
```

启动一个本地服务器来预览 `pnpm build` 的构建产物。用于验证生产构建是否正常工作。

## Tauri 开发

### 开发模式

```bash
pnpm tauri dev
```

同时启动前端开发服务器和 Rust 后端编译，打开 Tauri 桌面窗口。这是日常开发最常用的命令：

- 前端修改会触发 Vite HMR 热更新
- Rust 代码修改会触发自动重新编译
- 首次启动需要编译 Rust 依赖，耗时较长
- 后续启动会利用增量编译，速度更快

### 生产构建

```bash
pnpm tauri build
```

构建生产版本的安装包。此命令会依次执行：

1. TypeScript 类型检查
2. Vite 前端打包
3. Rust Release 模式编译
4. 生成平台特定的安装包

构建产物位于 `src-tauri/target/release/bundle/`。

## 测试

### 前端单元测试

```bash
# 运行所有前端单元测试
pnpm test:unit

# 运行特定测试文件
pnpm test:unit -- path/to/test.test.ts

# 监听模式（文件变更自动重新运行）
pnpm test:unit -- --watch
```

使用 Vitest + jsdom 环境，配合 @testing-library/react 进行组件测试。

### Rust 单元测试

```bash
# 运行所有 Rust 单元测试
pnpm test:rust

# 运行特定模块的测试
cargo test --manifest-path src-tauri/Cargo.toml -- module_name

# 显示测试输出
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### E2E 测试

```bash
# 运行所有 E2E 测试（串行模式）
pnpm test:e2e

# 运行特定测试文件
pnpm test:e2e -- --spec test/specs/example.spec.ts
```

使用 WebdriverIO 进行端到端测试，采用串行模式执行以确保稳定性。

## 格式化

### Rust 代码格式化

```bash
# 格式化 Rust 代码
pnpm format:rust

# 仅检查格式（不修改文件）
pnpm format:rust:check
```

使用 `cargo fmt` 进行 Rust 代码格式化，确保代码风格一致。

## 类型检查

### 全项目类型检查

```bash
# 前端构建检查 + Rust 类型检查
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

这是提交代码前推荐运行的检查命令，确保前后端代码都没有类型错误。

### 仅 Rust 类型检查

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

仅检查 Rust 后端的类型，比完整编译更快。

### 仅前端类型检查

```bash
pnpm build
```

前端构建过程包含 TypeScript 类型检查。

## 命令速查表

| 命令 | 用途 | 适用场景 |
|------|------|----------|
| `pnpm dev` | 前端开发服务器 | 纯前端开发 |
| `pnpm build` | 前端构建 + 类型检查 | 验证前端代码 |
| `pnpm tauri dev` | 全栈开发模式 | 日常开发 |
| `pnpm tauri build` | 生产构建 | 发布版本 |
| `pnpm test:unit` | 前端单元测试 | 验证组件逻辑 |
| `pnpm test:rust` | Rust 单元测试 | 验证后端逻辑 |
| `pnpm test:e2e` | E2E 测试 | 验证完整流程 |
| `pnpm format:rust` | 格式化 Rust 代码 | 代码提交前 |
| `pnpm format:rust:check` | 检查 Rust 格式 | CI 检查 |
| `cargo check` | Rust 类型检查 | 快速验证 Rust 代码 |
