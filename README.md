# QuantaNote

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/shenjianZ/QuantaNote/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)]()
[![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-000000?logo=rust)](https://www.rust-lang.org)

本地优先的桌面信息管理工具，支持 Markdown 笔记、全文搜索、标签管理和版本历史。

## 功能

- Markdown 编辑器 (Vditor IR 模式)
- 全文搜索 (FTS5 + trigram)
- 标签管理与筛选
- 附件管理 (图片/音频/视频/PDF 预览)
- 版本历史与对比
- 数据导入导出 (JSON)
- 系统托盘与开机自启
- 深色/浅色主题

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19, TypeScript, Zustand 5, TailwindCSS 4, Vditor 3 |
| 后端 | Tauri 2, Rust, rusqlite 0.31 |
| 数据库 | SQLite (WAL 模式, FTS5) |
| 测试 | Vitest, WebDriverIO, cargo test |

## 开发

```bash
pnpm install
pnpm tauri dev
```

## 构建

```bash
pnpm tauri build
```

## 许可证

MIT
