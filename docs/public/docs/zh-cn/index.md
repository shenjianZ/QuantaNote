---
title: QuantaNote
description: QuantaNote — 本地优先的桌面信息管理工具，基于 Tauri 2.0 构建
author: QuantaNote Team
createdAt: 2026-05-03
lastUpdated: 2026-05-03
---

# QuantaNote

**本地优先**的桌面信息管理工具。你的数据始终在你的设备上，无需联网，无需订阅，完全掌控。

QuantaNote 基于 Tauri 2.0 构建，结合 Rust 后端的高性能与 React 前端的灵活性，为你提供一个轻量、快速、安全的笔记与知识管理体验。所有数据存储在本地 SQLite 数据库中，支持多设备同步与冲突解决。

## 核心特性

- ✍️ **Markdown 编辑** — 基于 Vditor 的所见即所得编辑器，支持实时预览、代码高亮、数学公式、流程图
- 🔍 **全文搜索** — 基于 SQLite FTS5 的毫秒级全文检索，支持中英文分词
- 🏷️ **标签管理** — 为笔记分配彩色标签，通过标签快速筛选和分类
- 📜 **版本历史** — 自动保存编辑历史，支持版本对比与一键回滚
- 📎 **附件管理** — 支持图片、文件等附件的嵌入和管理
- 🔄 **多设备同步** — 支持设备间数据同步，内置三方差异比较与冲突解决
- 💾 **数据安全** — 自动备份、手动导入导出，数据完全由你掌控
- 🌙 **主题切换** — 支持亮色与暗色主题，跟随系统或手动切换

## 为什么选择 QuantaNote

与基于云端的笔记应用不同，QuantaNote 将你的数据放在第一位：

- **完全离线** — 无需网络连接，随时随地记录和编辑
- **隐私至上** — 数据不经过任何第三方服务器，你的笔记只属于你
- **极致性能** — 本地 SQLite 数据库提供毫秒级响应，没有网络延迟
- **开放透明** — 开源项目，代码完全公开，接受社区审查和贡献

## 快速开始

从 GitHub Releases 下载最新版本的安装包：

- [下载 Windows 版本 (.msi / .exe)](https://github.com/shenjianZ/QuantaNote/releases)
- [下载 macOS 版本 (.dmg)](https://github.com/shenjianZ/QuantaNote/releases)
- [下载 Linux 版本 (.deb / .AppImage)](https://github.com/shenjianZ/QuantaNote/releases)

安装后首次启动，QuantaNote 会自动在 `~/.quantanote/` 目录下创建数据库文件 `quanta_note.sqlite`，无需额外配置即可使用。

## 链接

- **[文档](/docs)** — 浏览完整的使用指南和功能说明
- **[快速上手](/docs/guide/quick-start)** — 5 分钟学会使用 QuantaNote
- **[GitHub](https://github.com/shenjianZ/QuantaNote)** — 查看源码、提交问题或贡献代码
