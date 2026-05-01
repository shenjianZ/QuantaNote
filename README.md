# QuantaNote

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/shenjianZ/QuantaNote/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)]()
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust)](https://www.rust-lang.org)

本地优先的桌面信息管理工具，支持 Markdown 笔记、全文搜索、标签管理、附件、版本历史和自动备份。基于 Tauri 2.0，数据全部本地存储。

## 功能

### 笔记编辑
- Markdown 编辑器 (Vditor IR 模式)，支持快捷键工具栏
- 全文查找替换 (Ctrl+F / Ctrl+H)，支持区分大小写

### 搜索与组织
- 全文搜索 (FTS5 + trigram 双引擎)，支持中文子串检索
- 标签管理 (CRUD + 多对多关联 + 筛选)
- 命令面板 (Ctrl+K) 全局快速搜索

### 版本管理
- 版本历史记录，支持创建/预览/恢复
- 版本 Diff 对比，选择两个版本进行差异比较

### 附件管理
- 支持图片/音频/视频/PDF/文本预览

### 数据导入导出
- JSON 格式导入导出 (含附件)
- ZIP 格式选择性导出/导入 (可选标签、附件、版本历史)

### 自动备份
- 定时自动备份，可配置间隔和保留数量
- 备份管理器，查看/删除历史备份，手动触发即时备份

### 界面与主题
- 深色/浅色主题，跟随系统或手动设置
- 自定义强调色与字体

### 系统集成
- 系统托盘 (最小化/关闭到托盘，右键菜单)
- 开机自启动

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Zustand 5, TailwindCSS 4, Vditor 3 |
| 后端 | Tauri 2, Rust, rusqlite 0.31 |
| 数据库 | SQLite (WAL 模式, FTS5 全文搜索) |
| 测试 | Vitest, Playwright, cargo test |

## 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式 (前端 + Rust 后端)
pnpm tauri dev

# 仅前端开发 (Vite, 端口 1420)
pnpm dev
```

## 构建

```bash
# 构建生产包 (Windows: .msi + .exe, Linux: .deb + .AppImage, macOS: .dmg + .app)
pnpm tauri build

# 类型检查
pnpm build && cargo check --manifest-path src-tauri/Cargo.toml
```

## 下载

从 [GitHub Releases](https://github.com/shenjianZ/QuantaNote/releases) 下载对应平台的安装包。

## 许可证

MIT
