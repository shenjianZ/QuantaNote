# Changelog

本文件记录 QuantaNote 的版本更新历史。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [0.2.0] - 2026-05-15

### Added
- 列表项显示标签，最多显示3个，超出显示 +N
- React Error Boundary，防止组件渲染错误导致白屏
- 加载状态 UI，LibraryPage 骨架屏 + CommandPalette 搜索 spinner
- 全文查找替换 (Ctrl+F / Ctrl+H)，支持区分大小写
- 版本 Diff 对比功能，支持选择两个版本进行差异对比
- CI/CD 自动化构建，推送 tag 时自动构建 Windows/Linux/macOS 安装包

### Fixed
- 版本命令统一走 tauriCommands.ts 封装层

## [0.1.0] - 2026-05-01

### Added
- Markdown 笔记编辑器 (Vditor IR 模式)
- 全文搜索 (FTS5 + trigram 双引擎)
- 标签管理系统 (CRUD + 关联 + 筛选)
- 附件管理 (图片/音频/视频/PDF/文本预览)
- 版本历史 (创建/预览/恢复)
- 数据导入导出 (JSON 格式，含附件)
- 系统托盘 (最小化/关闭到托盘)
- 主题系统 (深色/浅色/自定义强调色)
- 命令面板 (Ctrl+K 全局搜索)
- 开机自启动
